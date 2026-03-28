import sys
import os
import re
import json
import base64
import shutil
import asyncio
import traceback
from datetime import datetime
from fastapi import UploadFile, HTTPException, Form
from qdrant_client import models
from langchain_core.messages import SystemMessage, HumanMessage

from Qdrant.Store import store_fmu, COLLECTION_NAME
from Qdrant.Client import client

# Import Agent instances
from agent.sub_agents.fetching_agent import FetchingAgent
from agent.sub_agents.atmospheric_agent import AtmosphericAgent
from agent.sub_agents.water_agent import WaterAgent
from agent.sub_agents.Supervisor import SupervisorAgent
from agent.sub_agents.Researcher import ResearcherAgent
from agent.sub_agents.Explainer import ExplainerAgent

# Global singletons to avoid re-initializing heavy models per request
fetcher = FetchingAgent()
atmos_agent = AtmosphericAgent()
water_agent = WaterAgent()
researcher = ResearcherAgent()
supervisor = SupervisorAgent(researcher_agent=researcher)
explainer = ExplainerAgent()


def filter_numeric_sensors(raw_sensors: dict):
    wanted = {"pH", "EC", "temp", "humidity"}
    clean = {}
    for k, v in raw_sensors.items():
        if k in wanted:
            try:
                clean[k] = float(v)
            except:
                pass
    return clean


def get_next_sequence_number(crop_id: str) -> int:
    try:
        count_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="crop_id", match=models.MatchValue(value=crop_id)
                )
            ]
        )
        count_result = client.count(
            collection_name=COLLECTION_NAME, count_filter=count_filter
        )
        return count_result.count + 1
    except:
        return 1


# --- ENDPOINTS ---
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

        # Metadata construction
        metadata = {
            "crop": target_crop,
            "stage": raw_sensor_data.get("stage", "Unknown"),
            "crop_id": target_crop_id,
            "sequence_number": seq_num,
            "sensors": clean_sensors,
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

        yield f"data: {json.dumps({'agent': 'FETCHER', 'text': '📡 Requesting data from simulator...'})}\n\n"
        await asyncio.sleep(0.5)

        # --- 2. DATA ---
        raw_sensor_data = json.loads(sensors_str)
        clean_sensors = filter_numeric_sensors(raw_sensor_data)

        target_crop = raw_sensor_data.get("crop", "Unknown")
        target_crop_id = raw_sensor_data.get("crop_id")
        if not target_crop_id:
            target_crop_id = f"Batch_{target_crop}_{datetime.now().strftime('%Y%m')}"

        seq_num = get_next_sequence_number(target_crop_id)

        yield f"data: {json.dumps({'agent': 'FETCHER', 'text': f'🔢 Sequence for {target_crop_id}: {seq_num}'})}\n\n"
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

        yield f"data: {json.dumps({'agent': 'FETCHER', 'text': f'🧠 FMU Created (ID: {query_fmu.id}) — Handing off to specialists.'})}\n\n"
        await asyncio.sleep(0.5)

        # --- 3. RESEARCH ---
        yield f"data: {json.dumps({'agent': 'RESEARCHER', 'text': f'🔍 Searching knowledge base for {target_crop} {metadata['stage']} stage...'})}\n\n"
        research_query = f"optimal hydroponic conditions for {target_crop} in {metadata['stage']} stage"
        research_context = researcher.search(research_query)
        await asyncio.sleep(0.5)
        yield f"data: {json.dumps({'agent': 'RESEARCHER', 'text': ' 📚 Found relevant scientific data.'})}\n\n"

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
        yield f"data: {json.dumps({'agent': 'ATMOSPHERIC', 'text': f' ✅ Plan Approved: {json.dumps(atmos_plan)}'})}\n\n"
        await asyncio.sleep(0.5)

        yield f"data: {json.dumps({'agent': 'WATER', 'text': '💧 Water Agent — deciding...'})}\n\n"
        water_plan = water_agent.reason(
            sensors=clean_sensors,
            research=research_context,
            strategy=strat_instr,
            history="No history provided.",
            image_b64=image_b64,
        )
        yield f"data: {json.dumps({'agent': 'WATER', 'text': f' ✅ Plan Approved: {json.dumps(water_plan)}'})}\n\n"
        await asyncio.sleep(0.5)

        # --- 5. SUPERVISOR ---
        yield f"data: {json.dumps({'agent': 'SUPERVISOR', 'text': ' 🔗 Supervisor Merging Plans...'})}\n\n"
        await asyncio.sleep(0.3)
        yield f"data: {json.dumps({'agent': 'SUPERVISOR', 'text': ' ⚖️ Supervisor Judging...'})}\n\n"

        final_decision_json = supervisor.synthesize_plan(
            atmos_plan,
            water_plan,
            query_fmu,
            "No history context.",
            strategy_info=(strat_name, strat_instr, action_idx),
        )

        await asyncio.sleep(0.5)
        yield f"data: {json.dumps({'agent': 'SUPERVISOR', 'text': ' ✅ Plan looks solid.'})}\n\n"

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
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return None


async def process_text_query(text: str, crop_id: str = None):
    """
    HYBRID FILTER ENGINE:
    Uses LLM to extract Exact/Range/Text filters

    When crop_id is provided the caller has selected a specific crop, so we
    inject a should-match for that crop_id to bias results toward it.
    """
    system_prompt = """
    You are a Database Translator for an AI Hydroponic Farm.
    Your goal: Convert natural language queries into a precise JSON filter object.
    
    AVAILABLE METADATA FIELDS (String):
    - crop (e.g., "Tomato", "Lettuce", "Basil")
    - stage (e.g., "Seedling", "Vegetative", "Flowering")
    - outcome (e.g., "Positive", "Negative")
    
    AVAILABLE SENSOR FIELDS (Numeric):
    - pH (float, e.g., 5.5 to 6.5)
    - EC (float, e.g., 1.0 to 3.0)
    - temp (float, e.g., 20.0 to 30.0)
    - humidity (float, e.g., 40.0 to 80.0)
    
    AVAILABLE AGENT LOGIC FIELDS (Text/Substring):
    - action_taken (Use this to search for specific agent decisions like "FLUSH", "INCREASE_WATER", "DECREASE_NUTRIENTS")
    - strategic_intent (e.g., "STANDARD_MAINTENANCE", "RECOVERY")
    
    OUTPUT SCHEMA:
    {
      "filters": [
        {
          "field": "field_name",
          "operator": "exact" | "text" | "gt" | "lt" | "gte" | "lte",
          "value": string_or_number
        }
      ]
    }
    
    RULES:
    1. Use "exact" for exact string matches (crop, stage, outcome, strategic_intent).
    2. Use "text" for partial/substring matches (CRITICAL for 'action_taken' since it contains stringified JSON records).
    3. Use "gt", "lt", "gte", "lte" for numeric sensor comparisons.
    4. Translate queries into English (e.g., "Tamatar" -> "Tomato", "Kharab" -> "Negative").
    5. For queries about "similar crops" or "crops like X", extract the crop name as an exact filter on 'crop'.
    
    EXAMPLE: "Find tomato crops in vegetative stage with pH over 6.0 where the agent flushed the tank"
    {
      "filters": [
        { "field": "crop", "operator": "exact", "value": "Tomato" },
        { "field": "stage", "operator": "exact", "value": "Vegetative" },
        { "field": "pH", "operator": "gt", "value": 6.0 },
        { "field": "action_taken", "operator": "text", "value": "FLUSH" }
      ]
    }
    
    Return ONLY valid JSON. If no filters apply, return { "filters": [] }.
    """

    try:
        response = supervisor.model.invoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=text)]
        )

        raw_output = response.content
        filter_logic = extract_json(raw_output)

        if not filter_logic:
            return {
                "status": "error",
                "message": "Failed to parse JSON filter.",
                "query_logic": raw_output,
            }

        qdrant_conditions = []
        post_filters = []

        if "filters" in filter_logic:
            for rule in filter_logic["filters"]:
                field = rule.get("field")
                op = rule.get("operator", "exact")
                val = rule.get("value")

                if not field or val is None:
                    continue

                # Text substring matches (Python post-filter)
                if op == "text":
                    post_filters.append((field, str(val).lower()))
                    continue

                # Numeric sensor fields (nested routing)
                if field.lower() in ["ph", "ec", "temp", "humidity"]:
                    field_norm = {
                        "ph": "pH",
                        "ec": "EC",
                        "temp": "temp",
                        "humidity": "humidity",
                    }.get(field.lower(), field)
                    path1 = f"sensors.{field_norm}"
                    path2 = f"sensor_data.{field_norm}"

                    if op == "exact":
                        qdrant_conditions.append(
                            models.Filter(
                                should=[
                                    models.FieldCondition(
                                        key=path1, match=models.MatchValue(value=val)
                                    ),
                                    models.FieldCondition(
                                        key=path2, match=models.MatchValue(value=val)
                                    ),
                                ]
                            )
                        )
                    else:
                        try:
                            num_val = float(val)
                            range_kwargs = {op: num_val}
                            qdrant_conditions.append(
                                models.Filter(
                                    should=[
                                        models.FieldCondition(
                                            key=path1,
                                            range=models.Range(**range_kwargs),
                                        ),
                                        models.FieldCondition(
                                            key=path2,
                                            range=models.Range(**range_kwargs),
                                        ),
                                    ]
                                )
                            )
                        except ValueError:
                            pass
                else:
                    # Exact string fields
                    qdrant_conditions.append(
                        models.FieldCondition(
                            key=field, match=models.MatchValue(value=val)
                        )
                    )

        # Build Qdrant filter
        scroll_filter = (
            models.Filter(must=qdrant_conditions) if qdrant_conditions else None
        )

        results, _ = client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=scroll_filter,
            limit=100,
            with_payload=True,
            with_vectors=False,
        )

        # Python post-filter (for text/substring fields like action_taken)
        filtered_results = []
        for res in results:
            payload = res.payload or {}
            passed = True
            for pf_field, pf_val in post_filters:
                if pf_val not in str(payload.get(pf_field, "")).lower():
                    passed = False
                    break
            if passed:
                filtered_results.append(res)
            if len(filtered_results) >= 10:
                break

        # If a specific crop was selected, sort its results to the top
        if crop_id:
            filtered_results.sort(
                key=lambda p: 0 if p.payload.get("crop_id") == crop_id else 1
            )

        return {
            "status": "success",
            "results": [
                {"id": str(p.id), "score": 1.0, "payload": p.payload}
                for p in filtered_results
            ],
            "query_logic": filter_logic,
        }

    except Exception as e:
        print(f"❌ Text Search Error: {e}")
        import traceback

        traceback.print_exc()
        return {"status": "error", "message": str(e)}


async def process_audio_search(file: UploadFile):
    import whisper

    temp_filename = f"temp_audio_{file.filename}"
    try:
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        model = whisper.load_model("base")
        result = model.transcribe(temp_filename)
        detected_text = result["text"].strip()

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


async def process_ask_query(query: str, context: str, language: str):
    """
    Directly answers user questions using farm data context.
    The context string already contains similar-crop data pre-built by the
    frontend; this function just passes it through to the LLM.
    """
    try:
        lang_instr = (
            "Respond entirely in Hindi."
            if language == "hi"
            else "Respond entirely in English."
        )
        system_prompt = f"""
        You are Demeter Intelligence, an expert AI agronomist for a hydroponic farm.
        Use the FARM DATA below to answer the user's question accurately and concisely.

        {context}

        Instructions:
        - Wrap your internal reasoning in <thinking>...</thinking> tags.
        - After </thinking>, give a clear direct answer.
        - When referencing specific crops, mention their crop_id in parentheses.
        - If the question requires comparing multiple crops, address each one.
        - CRITICAL: {lang_instr}
        """

        response = supervisor.model.invoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=query)]
        )

        raw_text = response.content
        thinking = ""
        answer = raw_text

        think_match = re.search(r"<thinking>(.*?)</thinking>", raw_text, re.DOTALL)
        if think_match:
            thinking = think_match.group(1).strip()
            answer = re.sub(
                r"<thinking>.*?</thinking>", "", raw_text, flags=re.DOTALL
            ).strip()

        return {"status": "success", "thinking": thinking, "answer": answer}
    except Exception as e:
        import traceback

        traceback.print_exc()
        return {"status": "error", "message": str(e)}


async def process_similar_crops(crop_id: str, crop_name: str, payload_json: str):
    """
    Find cosine-similar crops using the ACTUAL stored vector for crop_id
    """
    import json as _json
    import numpy as np

    try:
        # Find the latest point for this crop
        filter_latest = models.Filter(
            must=[
                models.FieldCondition(
                    key="crop_id",
                    match=models.MatchValue(value=crop_id),
                )
            ]
        )

        points, _ = client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=filter_latest,
            limit=100,
            with_payload=True,
            with_vectors=True,  # <-- we need the actual stored vector
        )

        query = None

        if points:
            # Pick the point with the highest sequence_number
            best = max(points, key=lambda p: p.payload.get("sequence_number", 0))
            v = best.vector
            if v is not None:
                # v may be a list or a dict (named vectors); handle both
                if isinstance(v, dict):
                    # Named vector collections — grab the default/first key
                    v = next(iter(v.values()))
                query = list(v)

        # Fallback: build sensor vector from payload JSON
        if query is None:
            print(
                f"[SimilarCrops] No stored vector for {crop_id}, falling back to sensor encoding"
            )
            try:
                from Sentinel.Encoders.TimeSeries import SensorEncoder

                payload = _json.loads(payload_json) if payload_json else {}
                raw_sensors = payload.get("sensor_data") or payload.get("sensors") or {}
                # Keep only the four numeric sensors
                clean = {}
                for k, v in raw_sensors.items():
                    if k in {"pH", "EC", "temp", "humidity"}:
                        try:
                            clean[k] = float(v)
                        except (TypeError, ValueError):
                            pass

                if clean:
                    encoder = SensorEncoder()
                    sensor_vec = encoder.encode(clean)  # shape: (4,) or (12,)
                    # Pad to COLLECTION vector size (516) with zeros
                    full_vec = np.zeros(516, dtype=np.float32)
                    full_vec[-len(sensor_vec) :] = sensor_vec
                    query = full_vec.tolist()
            except Exception as enc_err:
                print(f"[SimilarCrops] Sensor encoding fallback failed: {enc_err}")

        if query is None:
            return {
                "status": "error",
                "message": f"Could not build a query vector for crop_id={crop_id}",
                "results": [],
            }

        # Cector search, excluding this crop
        exclude_filter = models.Filter(
            must_not=[
                models.FieldCondition(
                    key="crop_id",
                    match=models.MatchValue(value=crop_id),
                )
            ]
        )

        search_results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query,
            query_filter=exclude_filter,
            limit=6,
            with_payload=True,
            with_vectors=False,
        )

        return {
            "status": "success",
            "results": [
                {
                    "id": str(r.id),
                    "score": float(r.score),
                    "payload": r.payload,
                }
                for r in search_results
            ],
        }

    except Exception as e:
        import traceback

        traceback.print_exc()
        return {"status": "error", "message": str(e), "results": []}
