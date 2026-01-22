import os
import shutil
import json
import traceback
from fastapi import UploadFile
from qdrant_client.http import models
from datetime import datetime

# --- AGENT IMPORTS ---
from agent.sub_agents.Researcher import ResearcherAgent
from agent.sub_agents.Supervisor import SupervisorAgent
from agent.sub_agents.atmospheric_agent import AtmosphericAgent
from agent.sub_agents.water_agent import WaterAgent
from agent.sub_agents.judge_agent import JudgeAgent
from agent.sub_agents.Explainer import ExplainerAgent 

from Qdrant.Store import store_fmu, COLLECTION_NAME
from Qdrant.Client import client

# --- INITIALIZE COGNITIVE STACK ---
print("🌱 Initializing Demeter Cognitive Stack (Bandit Disabled)...")

researcher = ResearcherAgent()
atmos_agent = AtmosphericAgent()
water_agent = WaterAgent()
supervisor = SupervisorAgent(researcher_agent=researcher) 
judge = JudgeAgent()
explainer = ExplainerAgent(supervisor.model) 

print("✅ Agents Ready.")

# --- HELPER FUNCTIONS ---

def get_next_sequence_number(crop_id: str) -> int:
    try:
        count_result = client.count(
            collection_name=COLLECTION_NAME,
            count_filter=models.Filter(
                must=[models.FieldCondition(key="crop_id", match=models.MatchValue(value=crop_id))]
            )
        )
        return count_result.count + 1
    except Exception as e:
        print(f"⚠️ Could not calculate sequence: {e}")
        return 1

def filter_numeric_sensors(raw_data: dict) -> dict:
    """
    Extracts only floating-point sensor values.
    """
    clean = {}
    valid_keys = ["ph", "ec", "temp", "humidity", "co2", "light", "tds", "do", "orp"]
    
    for k, v in raw_data.items():
        if any(valid in k.lower() for valid in valid_keys):
            try:
                clean[k] = float(v)
            except (ValueError, TypeError):
                pass 
    return clean

# --- CORE ENDPOINTS ---

async def process_ingest(file: UploadFile, sensors_str: str, metadata_str: str, builder):
    """
    Handles file saving, FMU creation, and storage logic.
    """
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        raw_sensor_data = json.loads(sensors_str)
        meta_data = json.loads(metadata_str)
        abs_image_path = os.path.abspath(temp_filename)
        
        clean_sensors = filter_numeric_sensors(raw_sensor_data)

        # 1. Identity Logic
        target_crop = meta_data.get("crop", "Unknown")
        target_crop_id = meta_data.get("crop_id") or raw_sensor_data.get("crop_id")
        if not target_crop_id:
             target_crop_id = f"Batch_{target_crop}_{datetime.now().strftime('%Y%m')}"
        
        seq_num = get_next_sequence_number(target_crop_id)
        print(f"📥 Ingesting {target_crop_id} | Snapshot #{seq_num}")

        # 2. Metadata Injection
        meta_data.update({
            "crop_id": target_crop_id,
            "sequence_number": seq_num,
            "sensor_data": clean_sensors,
            "action_taken": meta_data.get("action_taken", "PENDING_ACTION"),
            "outcome": meta_data.get("outcome", "PENDING_OBSERVATION"),
        })

        # 3. Store
        fmu = builder.create_fmu(abs_image_path, clean_sensors, meta_data)
        store_fmu(fmu)
        
        return {"status": "success", "fmu_id": fmu.id}

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

async def process_search(file: UploadFile, sensors_str: str, builder):
    """
    RUNS THE DEMETER AGENT LOOP (Standard Mode - No Bandit)
    """
    temp_filename = f"temp_search_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        raw_sensor_data = json.loads(sensors_str)
        abs_image_path = os.path.abspath(temp_filename)
        
        clean_sensors = filter_numeric_sensors(raw_sensor_data)
        
        # --- 1. Create Query FMU ---
        target_crop = raw_sensor_data.get("crop", "Unknown")
        target_crop_id = raw_sensor_data.get("crop_id", f"Batch_{target_crop}_{datetime.now().strftime('%Y%m')}")
        seq_num = get_next_sequence_number(target_crop_id)
        
        metadata = {
            "crop": target_crop, 
            "stage": raw_sensor_data.get("stage", "Unknown"),
            "crop_id": target_crop_id,
            "sequence_number": seq_num,
            "sensor_data": clean_sensors,
            "action_taken": "PENDING_DECISION", 
            "outcome": "PENDING"
        }

        query_fmu = builder.create_fmu(abs_image_path, clean_sensors, metadata=metadata)
        store_fmu(query_fmu)
        print(f"📝 Processing FMU ID: {query_fmu.id}")

        # --- 2. JUDGE (Review Previous) ---
        # We run the Judge to update the Database with the 'Outcome' of the last cycle.
        # But we do NOT use the result for training the Bandit.
        try:
            judge.review_previous_cycle(query_fmu)
        except Exception as e:
            print(f"⚠️ Judge Error (Non-Critical): {e}")

        # --- 3. STRATEGY (STATIC) ---
        # 🔴 CHANGED: Hardcoded Standard Strategy instead of Bandit
        strat_name = "STANDARD_MAINTENANCE"
        strat_instr = "Maintain optimal crop-specific parameters. Ensure homeostasis."
        action_idx = 0 # Dummy ID
        print(f"🛡️ Strategy Selected: {strat_name} (Manual Override)")

        # --- 4. RESEARCH ---
        hits = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_fmu.vector,
            limit=3,
            with_payload=True
        )
        
        points_list = hits.points if hasattr(hits, 'points') else hits

        # 2. Generate Context (Safe handling for missing payloads)
        history_context = "\n".join([
            f"- {(h.payload or {}).get('action_taken', 'Unknown')}: {(h.payload or {}).get('outcome', 'Unknown')}" 
            for h in points_list
        ])

        research_query = f"optimal hydroponic conditions for {target_crop} in {metadata['stage']} stage"
        research_context = researcher.search(research_query)

        # --- 5. SUB-AGENTS ---
        print("🧠 Specialists Planning...")
        
        atmos_plan = atmos_agent.reason(
            sensors=clean_sensors, 
            research=research_context, 
            strategy=strat_instr, 
            history=history_context
        )
        
        water_plan = water_agent.reason(
            sensors=clean_sensors, 
            research=research_context, 
            strategy=strat_instr, 
            history=history_context
        )

        # --- 6. SUPERVISOR ---
        print("👮 Supervisor Finalizing...")
        
        final_decision_json = supervisor.synthesize_plan(
            atmos_plan, 
            water_plan, 
            query_fmu, 
            history_context,
            strategy_info=(strat_name, strat_instr, action_idx)
        )

        # --- 7. EXPLAINER ---
        current_fmu_context = {
            "metadata": metadata,
            "payload": {"sensors": clean_sensors},
            "vector": query_fmu.vector.tolist() if hasattr(query_fmu.vector, 'tolist') else query_fmu.vector
        }
        similar_fmus_formatted = [{"score": h.score, "payload": h.payload} for h in points_list]
        sub_agent_reports = {"Atmospheric": atmos_plan, "Water": water_plan}

        explanation_log = explainer.explain(
            current_fmu=current_fmu_context,
            similar_fmus=similar_fmus_formatted,
            sub_agent_reports=sub_agent_reports,
            final_decision=final_decision_json
        )

        # Update Record
        client.set_payload(
            collection_name=COLLECTION_NAME,
            points=[query_fmu.id],
            payload={
                "action_taken": str(final_decision_json),
                "outcome": "PENDING_OBSERVATION",
                "explanation_log": explanation_log,
                "strategic_intent": strat_name
            }
        )

        return {
            "status": "success",
            "new_fmu_id": query_fmu.id,
            "strategy": strat_name,
            "agent_decision": final_decision_json,
            "explanation": explanation_log,
            # 🟢 FIX: Include 'payload' here so the frontend can read 'crop'
            "search_results": [{"id": h.id, "score": h.score, "payload": h.payload} for h in points_list]
        }

    except Exception as e:
        print(f"❌ Pipeline Error: {e}")
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

async def process_text_query(text: str):
    try:
        from langchain_core.messages import SystemMessage, HumanMessage
        
        system_prompt = "You are a Database Translator. Convert natural language to JSON filters..."
        response = supervisor.model.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=text)
        ])
        
        content = response.content.replace("```json", "").replace("```", "").strip()
        filter_logic = json.loads(content)
        
        conditions = []
        for item in filter_logic.get("must", []):
            conditions.append(
                models.FieldCondition(
                    key=item["key"],
                    match=models.MatchValue(value=item["match"])
                )
            )

        if conditions:
            scroll_filter = models.Filter(must=conditions)
            results = client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=scroll_filter,
                limit=10,
                with_payload=True
            )
        else:
            results = client.scroll(collection_name=COLLECTION_NAME, limit=10, with_payload=True)
            
        points = results[0]
        return {
            "status": "success",
            "results": [{"id": p.id, "payload": p.payload} for p in points]
        }

    except Exception as e:
        print(f"Query Parse Error: {e}")
        return {"status": "error", "message": str(e)}

async def process_audio_search(file: UploadFile):
    return {"status": "error", "message": "Audio search temporarily disabled."}