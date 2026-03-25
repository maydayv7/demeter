import os
import shutil
import json
import traceback
import base64
import asyncio
from fastapi import UploadFile, HTTPException
from groq import Groq
from qdrant_client.http import models
from datetime import datetime
import re
from langchain_core.messages import SystemMessage, HumanMessage

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
print("🌱 Initializing Demeter Cognitive Stack....")

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
                must=[
                    models.FieldCondition(
                        key="crop_id", match=models.MatchValue(value=crop_id)
                    )
                ]
            ),
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


async def process_ingest(
    file: UploadFile, sensors_str: str, metadata_str: str, builder
):
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
        meta_data.update(
            {
                "crop_id": target_crop_id,
                "sequence_number": seq_num,
                "sensor_data": clean_sensors,
                "action_taken": meta_data.get("action_taken", "PENDING_ACTION"),
                "outcome": meta_data.get("outcome", "PENDING_OBSERVATION"),
            }
        )

        # 3. Store
        fmu = builder.create_fmu(abs_image_path, clean_sensors, meta_data)
        store_fmu(fmu)

        return {"status": "success", "fmu_id": fmu.id}

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)


async def process_search(file: UploadFile, sensors_str: str, builder):
    """
    SIMPLIFIED AGENT LOOP: Atmos + Water + Supervisor ONLY.
    """
    temp_filename = f"temp_search_{file.filename}"

    try:
        # --- 1. SETUP: File & Base64 ---
        file_content = await file.read()

        # Save to disk (Required for FMU Builder)
        with open(temp_filename, "wb") as buffer:
            buffer.write(file_content)

        # Encode to Base64 (Required for Agents)
        image_b64 = base64.b64encode(file_content).decode("utf-8")
        abs_image_path = os.path.abspath(temp_filename)

        # --- 2. DATA: Parse Sensors ---
        raw_sensor_data = json.loads(sensors_str)
        clean_sensors = filter_numeric_sensors(raw_sensor_data)

        target_crop = raw_sensor_data.get("crop", "Unknown")
        target_crop_id = raw_sensor_data.get("crop_id")
        if not target_crop_id:
            target_crop_id = f"Batch_{target_crop}_{datetime.now().strftime('%Y%m')}"
        seq_num = get_next_sequence_number(target_crop_id)

        # Metadata construction (Using "sensors" key as requested)
        metadata = {
            "crop": target_crop,
            "stage": raw_sensor_data.get("stage", "Unknown"),
            "crop_id": target_crop_id,
            "sequence_number": seq_num,
            "sensors": clean_sensors,  # <--- Correct key for web
            "action_taken": "PENDING_DECISION",
            "outcome": "PENDING",
        }

        # Create and Store FMU (Snapshot of current state)
        query_fmu = builder.create_fmu(abs_image_path, clean_sensors, metadata=metadata)
        store_fmu(query_fmu)
        print(f"📝 Processing FMU ID: {query_fmu.id}")

        # --- 3. CONTEXT (Minimal) ---
        # Static strategy for web simplicity
        strat_instr = "Maintain optimal crop-specific parameters."
        strat_name = "STANDARD_MAINTENANCE"
        action_idx = 0

        # --- 4. RESEARCH ---
        hits = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_fmu.vector,
            limit=3,
            with_payload=True,
        )

        points_list = hits.points if hasattr(hits, "points") else hits

        research_query = f"optimal hydroponic conditions for {target_crop} in {metadata['stage']} stage"
        research_context = researcher.search(research_query)

        # --- 4. SUB-AGENTS (Atmos & Water) ---
        print("🧠 Specialists Planning...")

        # Pass empty strings for research/history, pass image_b64 for visuals
        atmos_plan = atmos_agent.reason(
            sensors=clean_sensors,
            research=research_context,
            strategy=strat_instr,
            history="No history provided.",
            image_b64=image_b64,
        )

        water_plan = water_agent.reason(
            sensors=clean_sensors,
            research=research_context,
            strategy=strat_instr,
            history="No history provided.",
            image_b64=image_b64,
        )

        print(f"🌬️ Atmospheric Plan:\n{atmos_plan}")
        print(f"💧 Water Plan:\n{water_plan}")

        # --- 5. SUPERVISOR (Synthesis) ---
        print("👮 Supervisor Finalizing...")

        final_decision_json = supervisor.synthesize_plan(
            atmos_plan,
            water_plan,
            query_fmu,
            "No history context.",
            strategy_info=(strat_name, strat_instr, action_idx),
        )

        sub_agent_reports = {"Atmospheric": atmos_plan, "Water": water_plan}

        current_fmu_context = {
            "metadata": metadata,
            "payload": {"sensors": clean_sensors},
            "vector": (
                query_fmu.vector.tolist()
                if hasattr(query_fmu.vector, "tolist")
                else query_fmu.vector
            ),
        }
        similar_fmus_formatted = [
            {"score": h.score, "payload": h.payload} for h in points_list
        ]
        explanation_log = explainer.explain(
            current_fmu=current_fmu_context,
            similar_fmus=similar_fmus_formatted,
            sub_agent_reports=sub_agent_reports,
            final_decision=final_decision_json,
        )

        # --- 6. DB UPDATE ---
        # Record the decision
        client.set_payload(
            collection_name=COLLECTION_NAME,
            points=[query_fmu.id],
            payload={
                "action_taken": str(final_decision_json),
                "outcome": "PENDING_OBSERVATION",
                "strategic_intent": strat_name,
            },
        )

        return {
            "status": "success",
            "new_fmu_id": query_fmu.id,
            "agent_decision": final_decision_json,
            "explanation": explanation_log,
            "search_results": [
                {"id": p.id, "score": p.score, "payload": p.payload}
                for p in points_list
            ],
        }

    except Exception as e:
        print(f"❌ Pipeline Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Cleanup temp file
        if os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except Exception:
                pass


async def process_cycle_stream(file: UploadFile, sensors_str: str, builder):
    """
    REAL-TIME AGENT LOOP: Streams step-by-step reasoning via SSE.
    """
    temp_filename = f"temp_stream_{file.filename}"

    try:
        yield f"data: {json.dumps({'agent': 'SYSTEM', 'text': '🚀 Initializing Demeter Orchestrator...'})}\n\n"
        await asyncio.sleep(0.5)

        # --- 1. SETUP ---
        file_content = await file.read()
        with open(temp_filename, "wb") as buffer:
            buffer.write(file_content)

        image_b64 = base64.b64encode(file_content).decode("utf-8")
        abs_image_path = os.path.abspath(temp_filename)

        yield f"data: {json.dumps({'agent': 'FETCHER', 'text': '[Fetcher] 📡 Requesting data from simulator...'})}\n\n"
        await asyncio.sleep(0.5)

        # --- 2. DATA ---
        raw_sensor_data = json.loads(sensors_str)
        clean_sensors = filter_numeric_sensors(raw_sensor_data)

        target_crop = raw_sensor_data.get("crop", "Unknown")
        target_crop_id = raw_sensor_data.get("crop_id")
        if not target_crop_id:
            target_crop_id = f"Batch_{target_crop}_{datetime.now().strftime('%Y%m')}"

        seq_num = get_next_sequence_number(target_crop_id)
        yield f"data: {json.dumps({'agent': 'FETCHER', 'text': f'[Fetcher] 🔢 Sequence for {target_crop_id}: {seq_num}'})}\n\n"
        await asyncio.sleep(0.3)

        metadata = {
            "crop": target_crop,
            "stage": raw_sensor_data.get("stage", "Unknown"),
            "crop_id": target_crop_id,
            "sequence_number": seq_num,
            "sensors": clean_sensors,
            "action_taken": "PENDING_DECISION",
            "outcome": "PENDING",
        }

        query_fmu = builder.create_fmu(abs_image_path, clean_sensors, metadata=metadata)
        store_fmu(query_fmu)
        yield f"data: {json.dumps({'agent': 'FETCHER', 'text': f'[Fetcher] 🧠 FMU Created (ID: {query_fmu.id}) — Handing off to specialists.'})}\n\n"
        await asyncio.sleep(0.5)

        # --- 3. RESEARCH ---
        yield f"data: {json.dumps({'agent': 'RESEARCHER', 'text': f'🔍 Searching knowledge base for {target_crop} {metadata['stage']} stage...'})}\n\n"
        research_query = f"optimal hydroponic conditions for {target_crop} in {metadata['stage']} stage"
        research_context = researcher.search(research_query)
        await asyncio.sleep(0.5)
        yield f"data: {json.dumps({'agent': 'RESEARCHER', 'text': '   📚 Found relevant scientific data.'})}\n\n"

        # --- 4. AGENTS ---
        strat_instr = "Maintain optimal crop-specific parameters."
        strat_name = "STANDARD_MAINTENANCE"
        action_idx = 0

        yield f"data: {json.dumps({'agent': 'BANDIT', 'text': f'🎰 BANDIT STRATEGY: {strat_name}'})}\n\n"
        await asyncio.sleep(0.3)

        yield f"data: {json.dumps({'agent': 'ATMOSPHERIC', 'text': '🌬️ Atmospheric Agent — deciding...'})}\n\n"
        atmos_plan = atmos_agent.reason(
            sensors=clean_sensors,
            research=research_context,
            strategy=strat_instr,
            history="No history provided.",
            image_b64=image_b64,
        )
        yield f"data: {json.dumps({'agent': 'ATMOSPHERIC', 'text': f'   ✅ Plan Approved: {json.dumps(atmos_plan)}'})}\n\n"
        await asyncio.sleep(0.5)

        yield f"data: {json.dumps({'agent': 'WATER', 'text': '💧 Water Agent — deciding...'})}\n\n"
        water_plan = water_agent.reason(
            sensors=clean_sensors,
            research=research_context,
            strategy=strat_instr,
            history="No history provided.",
            image_b64=image_b64,
        )
        yield f"data: {json.dumps({'agent': 'WATER', 'text': f'   ✅ Plan Approved: {json.dumps(water_plan)}'})}\n\n"
        await asyncio.sleep(0.5)

        # --- 5. SUPERVISOR ---
        yield f"data: {json.dumps({'agent': 'SUPERVISOR', 'text': '   🔗 Supervisor Merging Plans...'})}\n\n"
        await asyncio.sleep(0.3)
        yield f"data: {json.dumps({'agent': 'SUPERVISOR', 'text': '   ⚖️ Supervisor Judging...'})}\n\n"

        final_decision_json = supervisor.synthesize_plan(
            atmos_plan,
            water_plan,
            query_fmu,
            "No history context.",
            strategy_info=(strat_name, strat_instr, action_idx),
        )
        await asyncio.sleep(0.5)
        yield f"data: {json.dumps({'agent': 'SUPERVISOR', 'text': '   ✅ Plan looks solid.'})}\n\n"

        # --- 6. FINAL ---
        yield f"data: {json.dumps({'agent': 'SUPERVISOR', 'text': f'🚜 Activating Hardware: {json.dumps(final_decision_json)}'})}\n\n"
        await asyncio.sleep(0.5)

        yield f"data: {json.dumps({'agent': 'SYSTEM', 'text': '✅ Sent to Simulator. Cycle complete.', 'final_action': final_decision_json, 'phase': 'done'})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'agent': 'SYSTEM', 'text': f'❌ Error: {str(e)}', 'level': 'error'})}\n\n"

    finally:
        if os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except Exception:
                pass


def extract_json(text):
    """
    Robustly extracts the first valid JSON object from text string.
    """
    # Strip <think>...</think> blocks FIRST — reasoning models emit these before the answer
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

    for source in (cleaned, text):  # fall back to raw text if stripping broke something
        try:
            # 1. Try direct parse (model returned only JSON)
            return json.loads(source)
        except Exception:
            pass

        try:
            # 2. Try finding content inside ```json ... ```
            match = re.search(r"```json\s*(\{.*?\})\s*```", source, re.DOTALL)
            if match:
                return json.loads(match.group(1))

            # 3. Try finding content inside plain ``` ... ```
            match = re.search(r"```\s*(\{.*?\})\s*```", source, re.DOTALL)
            if match:
                return json.loads(match.group(1))

            # 4. Fallback: Find the LAST outermost { ... } (avoids grabbing think-block JSON)
            matches = list(
                re.finditer(r"(\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\})", source, re.DOTALL)
            )
            if matches:
                return json.loads(matches[-1].group(1))

        except Exception:
            pass

    return {}


async def process_text_query(text: str):

    try:
        # 🟢 1. STRICT SYSTEM PROMPT
        system_prompt = """
        You are a Database Translator. Convert the user's natural language query into a strict JSON filter for Qdrant.
        
        TARGET SCHEMA:
        {
            "must": [
                { "key": "crop", "match": "lettuce" },
                { "key": "stage", "match": "vegetative" }
            ]
        }
        
        RULES:
        1. Output ONLY valid JSON. No conversational text.
        2. Use the key "must" for the list of conditions.
        3. Field names in payload are usually: "crop", "crop_id", "stage", "outcome".
        4. If the user asks for everything, return { "must": [] }.
        """

        print(f"🗣️ User Query: {text}")

        response = supervisor.model.invoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=text)]
        )

        # 🟢 2. ROBUST PARSING
        filter_logic = extract_json(response.content)

        if not filter_logic:
            print(f"⚠️ Failed to parse JSON from: {response.content}")
            return {
                "status": "error",
                "message": "Could not understand query structure.",
            }

        print(f"⚙️ Parsed Logic: {filter_logic}")

        # 🟢 3. CONSTRUCT QDRANT FILTER
        conditions = []
        for item in filter_logic.get("must", []):
            conditions.append(
                models.FieldCondition(
                    key=item["key"], match=models.MatchValue(value=item["match"])
                )
            )

        # 🟢 4. EXECUTE SEARCH
        if conditions:
            scroll_filter = models.Filter(must=conditions)
            results = client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=scroll_filter,
                limit=10,
                with_payload=True,
            )
        else:
            # If no conditions, return the latest 10 items
            results = client.scroll(
                collection_name=COLLECTION_NAME, limit=10, with_payload=True
            )

        points = results[0]

        return {
            "status": "success",
            "results": [{"id": p.id, "payload": p.payload} for p in points],
        }

    except Exception as e:
        print(f"❌ Query Error: {e}")
        return {"status": "error", "message": str(e)}


groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


async def process_audio_search(file: UploadFile):
    """
    1. Transcribe Audio (Whisper-Large-V3) -> Text
    2. Run Text Search (via existing process_text_query)
    """
    temp_filename = f"temp_audio_{file.filename}"

    # Save audio temporarily
    try:
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        print("🎙️ Transcribing audio (Multilingual)...")

        # Open file in binary read mode
        with open(temp_filename, "rb") as audio_file:
            transcription = groq_client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3",  # Multilingual model
                response_format="json",
                prompt="The audio may contain English or Hindi technical terms about farming.",
            )

        detected_text = transcription.text
        print(f"📝 Heard: '{detected_text}'")

        # This ensures we get the same RAG/Qdrant logic as text queries
        response_data = await process_text_query(detected_text)

        # Inject the transcription so the UI can show what was heard
        response_data["transcription"] = detected_text

        return response_data

    except Exception as e:
        print(f"❌ Audio Search Error: {e}")
        return {"status": "error", "message": str(e)}

    finally:
        # Cleanup temp file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)


async def parse_natural_language_query(query_text: str):
    """
    Uses the Supervisor (LangChain) to convert text into Qdrant filters.
    """
    system_prompt = """
    You are a Database Translator.
    Your goal: Convert natural language queries (English, Hindi, Hinglish, etc.) into a JSON filter object for a Hydroponic Database.
    
    AVAILABLE FIELDS:
    - crop (e.g., Lettuce, Basil, Tomato)
    - stage (e.g., Seedling, Vegetative, Flowering)
    - outcome (Values: "Positive", "Negative", "Neutral")
    
    RULES:
    1. TRANSLATION: Map "Tamatar" -> "Tomato", "Kharab" -> "Negative", "Badhiya" -> "Positive".
    2. OUTPUT SCHEMA: { "must": [ {"key": "field", "match": "value"} ] }
    3. If no filters apply, return { "must": [] }.
    """

    try:
        # instead of raw .chat.completions.create
        response = supervisor.model.invoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=query_text)]
        )

        return extract_json(response.content)

    except Exception as e:
        print(f"❌ Query Parse Error: {e}")
        return {"must": []}
