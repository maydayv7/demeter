import os
import shutil
import json
import traceback
from fastapi import UploadFile
from qdrant_client.http import models

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
        
        fmu = builder.create_fmu(abs_image_path, sensor_data, meta_data)
        store_fmu(fmu)
        return {"status": "success", "fmu_id": fmu.id}

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

async def process_search(file: UploadFile, sensors_str: str, builder):
    """
    1. Search Similar FMUs (Memory)
    2. Consult Researcher (Knowledge)
    3. Run Supervisor (Reasoning)
    """
    temp_filename = f"temp_search_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        sensor_data = json.loads(sensors_str)
        abs_image_path = os.path.abspath(temp_filename)

        # --- STEP 1: Context Extraction ---
        target_crop = sensor_data.get("crop", "Unknown")
        target_stage = sensor_data.get("stage", "Unknown")
        print(f"🔎 Pipeline triggered for: {target_crop} ({target_stage})")

        # --- STEP 2: Vector Search (Memory) ---
        # Separate numeric data for vector construction
        numeric_sensors = {k: v for k, v in sensor_data.items() if k in ["pH", "EC", "temp", "humidity"]}
        metadata = {"crop": target_crop, "stage": target_stage}

        # Create Filter
        context_filter = models.Filter(
            must=[
                models.FieldCondition(key="crop", match=models.MatchValue(value=target_crop)),
                models.FieldCondition(key="stage", match=models.MatchValue(value=target_stage))
            ]
        )

        # Create Vector & Search
        query_fmu = builder.create_fmu(abs_image_path, numeric_sensors, metadata=metadata)
        query_vector = query_fmu.vector.tolist() if hasattr(query_fmu.vector, 'tolist') else query_fmu.vector

        try:
            response = client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                query_filter=context_filter,
                limit=3, # Get top 3 similar cases
                with_payload=True
            )
            hits = response.points
        except Exception:
            # Fallback to unfiltered if index missing
            print("⚠️ Filter failed, searching raw vectors...")
            hits = client.search(collection_name=COLLECTION_NAME, query_vector=query_vector, limit=3, with_payload=True)

        # Format Memory for the Supervisor
        similar_fmus_formatted = [
            {"score": hit.score, "payload": hit.payload} for hit in hits
        ]

        # --- STEP 3: The Reasoning Cycle ---
        print("🧠 Invoking Supervisor Agent...")
        
        # A. Get Expert Opinions
        mini_agent_reports = simulate_sub_agents(numeric_sensors)
        
        # B. Construct the Current FMU object for the Supervisor
        current_fmu_context = {
            "metadata": metadata,
            "payload": {"sensors": numeric_sensors}
        }

        # C. Run the Supervisor Logic (RAG + Groq)
        decision_json = supervisor.reason(
            current_fmu=current_fmu_context,
            similar_fmus=similar_fmus_formatted,
            sub_agent_outputs=mini_agent_reports
        )

        # --- STEP 4: Return Combined Result ---
        return {
            "status": "success",
            "search_results": [
                {"id": hit.id, "score": hit.score, "payload": hit.payload} for hit in hits
            ],
            "agent_decision": decision_json # <--- The frontend will render this!
        }

    except Exception as e:
        print(f"❌ Pipeline Error: {e}")
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)