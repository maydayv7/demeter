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
from Qdrant.Store import store_fmu, COLLECTION_NAME
from Qdrant.Client import client

# Initialize Agents ONCE (Global Scope) to save memory
print("🌱 Initializing Cognitive Stack...")
researcher = ResearcherAgent()
supervisor = SupervisorAgent(researcher)
print("✅ Agents Ready.")

# --- HELPER: SIMULATE MINI-AGENTS ---
# In production, these would be your actual imported classes from agent/sub_agents/
def get_next_sequence_number(crop_id: str) -> int:
    """
    Queries Qdrant to find how many snapshots exist for this specific crop_id.
    Returns count + 1.
    """
    try:
        count_result = client.count(
            collection_name=COLLECTION_NAME,
            count_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="crop_id", 
                        match=models.MatchValue(value=crop_id)
                    )
                ]
            )
        )
        return count_result.count + 1
    except Exception as e:
        print(f"⚠️ Could not calculate sequence: {e}")
        return 1
    
def simulate_sub_agents(sensors):
    """
    Generates 'Expert Opinions' based on raw sensor data.
    """
    reports = {}
    
    # 1. Nutrient Agent Logic
    ph = sensors.get("pH", 6.0)
    ec = sensors.get("EC", 1.5)
    if ph < 5.5:
        reports["nutrient"] = f"CRITICAL: pH is {ph} (Too Acidic). Risk of Nutrient Lockout."
    elif ph > 6.5:
        reports["nutrient"] = f"WARNING: pH is {ph} (Too Alkaline). Efficiency dropping."
    else:
        reports["nutrient"] = f"Optimal pH ({ph}). EC is {ec}."

    # 2. Atmosphere Agent Logic
    temp = sensors.get("temp", 25)
    humid = sensors.get("humidity", 60)
    if temp > 28:
        reports["atmosphere"] = f"Heat Stress Warning: {temp}°C is too high."
    elif humid > 80:
        reports["atmosphere"] = f"High Humidity ({humid}%). Vapor Pressure Deficit (VPD) is low."
    else:
        reports["atmosphere"] = "Climate is within nominal range."

    # 3. Resource Agent Logic
    reports["resources"] = "Water levels stable. Power grid nominal."
    
    return reports

async def process_ingest(file: UploadFile, sensors_str: str, metadata_str: str, builder):
    """
    Handles file saving, FMU creation, and storage logic.
    """
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        sensor_data = json.loads(sensors_str)
        meta_data = json.loads(metadata_str)
        abs_image_path = os.path.abspath(temp_filename)
        
        # --- 🟢 NEW: Add Sequence & ID Logic (Same as process_search) ---
        target_crop = meta_data.get("crop", "Unknown")
        
        # 1. Get Crop ID (Prefer metadata, fall back to sensor data, then auto-generate)
        target_crop_id = meta_data.get("crop_id") or sensor_data.get("crop_id")
        if not target_crop_id:
             target_crop_id = f"Batch_{target_crop}_{datetime.now().strftime('%Y%m')}"
        
        # 2. Calculate Sequence Number automatically
        seq_num = get_next_sequence_number(target_crop_id)
        
        print(f"📥 Ingesting {target_crop_id} | Snapshot #{seq_num}")

        # 3. Inject into Metadata BEFORE creating FMU
        meta_data.update({
            "crop_id": target_crop_id,
            "sequence_number": seq_num,
            "sensor_data": sensor_data,
            # Ensure placeholders exist if not provided
            "action_taken": meta_data.get("action_taken", "PENDING_ACTION"),
            "outcome": meta_data.get("outcome", "PENDING_OBSERVATION")
        })
        # -------------------------------------------------------------

        fmu = builder.create_fmu(abs_image_path, sensor_data, meta_data)
        store_fmu(fmu)
        
        return {"status": "success", "fmu_id": fmu.id}

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

async def process_search(file: UploadFile, sensors_str: str, builder):
    """
    1. Create & Save FMU (Placeholder State)
    2. Search Memory
    3. Run Supervisor
    """
    temp_filename = f"temp_search_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        sensor_data = json.loads(sensors_str)
        abs_image_path = os.path.abspath(temp_filename)

        numeric_sensors = {k: v for k, v in sensor_data.items() if k in ["pH", "EC", "temp", "humidity"]}

        # --- EXTRACT DATA ---
        target_crop = sensor_data.get("crop", "Unknown")
        target_stage = sensor_data.get("stage", "Unknown")

        
        # 👇 NEW: Extract Crop ID from frontend (or generate a default)
        target_crop_id = sensor_data.get("crop_id", f"Batch_{target_crop}_{datetime.now().strftime('%Y%m')}")
        
        # 👇 NEW: Calculate Sequence
        seq_num = get_next_sequence_number(target_crop_id)
        print(f"🔢 Processing {target_crop_id} | Snapshot #{seq_num}")

        metadata = {
            "crop": target_crop, 
            "stage": sensor_data.get("stage", "Unknown"),
            "crop_id": target_crop_id,   # <--- Added
            "sequence_number": seq_num,  # <--- Added
            "action_taken": "PENDING_USER_ACTION", 
            "outcome": "PENDING_OBSERVATION"
        }

        # Create & Store FMU
        query_fmu = builder.create_fmu(abs_image_path, numeric_sensors, metadata=metadata)
        store_fmu(query_fmu)
        print(f"📝 Created Query FMU ID: {query_fmu.id}")

        # --- STEP 2: Vector Search (Using the new FMU's vector) ---
        query_vector = query_fmu.vector.tolist() if hasattr(query_fmu.vector, 'tolist') else query_fmu.vector

        # Create Context Filter
        context_filter = models.Filter(
            must=[
                models.FieldCondition(key="crop", match=models.MatchValue(value=target_crop)),
                models.FieldCondition(key="stage", match=models.MatchValue(value=target_stage))
            ]
        )

        try:
            # We fetch 4 items so we can safely drop the current query if it appears
            response = client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                query_filter=context_filter,
                limit=4, 
                with_payload=True
            )
            hits = response.points
            
            # Filter out the current query ID if it appears in results (Self-Exclusion)
            hits = [hit for hit in hits if hit.id != query_fmu.id][:3]

        except Exception:
            print("⚠️ Filter failed, searching raw vectors...")
            hits = client.search(collection_name=COLLECTION_NAME, query_vector=query_vector, limit=4, with_payload=True)
            hits = [hit for hit in hits if hit.id != query_fmu.id][:3]

        similar_fmus_formatted = [{"score": hit.score, "payload": hit.payload} for hit in hits]

        # --- STEP 3: The Reasoning Cycle ---
        print("🧠 Invoking Supervisor Agent...")
        mini_agent_reports = simulate_sub_agents(numeric_sensors)
        
        current_fmu_context = {
            "metadata": metadata,
            "payload": {"sensors": numeric_sensors}
        }

        decision_json = supervisor.reason(
            current_fmu=current_fmu_context,
            similar_fmus=similar_fmus_formatted,
            sub_agent_outputs=mini_agent_reports
        )

        # --- STEP 4: Return Result + The New ID ---
        return {
            "status": "success",
            "new_fmu_id": query_fmu.id, # <--- Frontend needs this for the Feedback Loop
            "search_results": [{"id": h.id, "score": h.score, "payload": h.payload} for h in hits],
            "agent_decision": decision_json
        }

    except Exception as e:
        print(f"❌ Pipeline Error: {e}")
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

async def parse_natural_language_query(query_text: str):
    """
    Uses the LLM to convert a text query into structured Qdrant filters.
    """
    system_prompt = """
    You are a Database Translator.
    Your goal: Convert natural language queries (English, Hindi, Hinglish, etc.) into a JSON filter object for a Hydroponic Database.
    
    AVAILABLE FIELDS:
    - crop (e.g., Lettuce, Basil, Tomato)
    - stage (e.g., Seedling, Vegetative, Flowering)
    - outcome (Values: "Positive", "Negative", "Neutral", "PENDING_OBSERVATION")
    - action_taken (e.g., "Add CalMag", "Lower pH")
    - crop_id (e.g., "Batch_Lettuce_2026")

    RULES:
    1. TRANSLATION: The user may speak Hindi or mixed "Hinglish". You must map these to the standard English tags.
       - "Tamatar" -> crop: "Tomato"
       - "Kharab" / "Sadd gaya" / "Bekar" -> outcome: "Negative"
       - "Accha hai" / "Badhiya" -> outcome: "Positive"
       - "Paani" / "Water" -> (No direct filter unless context implies outcome)
    2. If user says "poor health", "bad", "failed" or similar negative words, map to outcome="Negative".
    3. If user says "good", "healthy" or other positive words, map to outcome="Positive".
    4. Output strictly JSON matching this structure:
       {
         "must": [
            {"key": "field_name", "match": "value"}
         ]
       }
    5. Return empty list [] if no specific filters apply.
    """

    try:
        response = supervisor.llm.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query_text}
            ],
            temperature=0,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"❌ Query Parse Error: {e}")
        return {"must": []}
    
async def process_text_query(text: str):
    """
    Handles natural language search requests.
    """
    print(f"🗣️ User asked: '{text}'")
    
    # 1. Translate Text -> Filters
    filter_logic = await parse_natural_language_query(text)
    print(f"⚙️ Generated Filters: {json.dumps(filter_logic, indent=2)}")

    # 2. Build Qdrant Filter
    conditions = []
    for item in filter_logic.get("must", []):
        conditions.append(
            models.FieldCondition(
                key=item["key"],
                match=models.MatchValue(value=item["match"])
            )
        )

    # 3. Query Database (Scroll is better for "List" queries than vector search)
    try:
        if conditions:
            # Search with filters
            scroll_filter = models.Filter(must=conditions)
            results = client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=scroll_filter,
                limit=10,
                with_payload=True
            )
        else:
            # No filters found, return latest
            results = client.scroll(
                collection_name=COLLECTION_NAME,
                limit=10,
                with_payload=True
            )
            
        points = results[0] # Scroll returns (points, offset)
        
        return {
            "status": "success",
            "results": [{"id": p.id, "payload": p.payload} for p in points]
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}
    
async def process_audio_search(file: UploadFile):
    """
    1. Transcribe Audio (Whisper) -> Text
    2. Run Text Search (LLM -> Filters)
    """
    temp_filename = f"temp_audio_{file.filename}"
    
    # Save audio temporarily
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        print("🎙️ Transcribing audio (Multilingual)...")
        audio_file = open(temp_filename, "rb")
        
        # 👇 CHANGE THIS MODEL
        transcription = supervisor.llm.audio.transcriptions.create(
            file=audio_file,
            model="whisper-large-v3", # 👈 Use the Multilingual Model (No "-en" suffix)
            response_format="json",
            prompt="The audio may contain English or Hindi technical terms about farming." # Optional hint
        )
        
        detected_text = transcription.text
        print(f"📝 Heard ({transcription.language if hasattr(transcription, 'language') else 'auto'}): '{detected_text}'")
        
        # 1. Get the standard search results
        response_data = await process_text_query(detected_text)
        # 2. 👇 INJECT the transcription into the response
        response_data["transcription"] = detected_text

        return response_data

    except Exception as e:
        print(f"❌ Audio Search Error: {e}")
        return {"status": "error", "message": str(e)}

    finally:
        # Cleanup
        if 'audio_file' in locals():
            audio_file.close()
        if os.path.exists(temp_filename):
            os.remove(temp_filename)