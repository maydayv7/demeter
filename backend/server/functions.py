import os
import shutil
import json
from fastapi import UploadFile
from Qdrant.Store import store_fmu, COLLECTION_NAME
from Qdrant.Client import client
from qdrant_client.http import models

async def process_ingest(file: UploadFile, sensors_str: str, metadata_str: str, builder):
    """
    Handles file saving, FMU creation, and storage logic.
    """
    # 1. Save Image Temporarily
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # 2. Parse Data
        sensor_data = json.loads(sensors_str)
        meta_data = json.loads(metadata_str)

        # 3. Create FMU
        abs_image_path = os.path.abspath(temp_filename)
        fmu = builder.create_fmu(abs_image_path, sensor_data, meta_data)

        # 4. Store in Cloud
        store_fmu(fmu)
        return {"status": "success", "fmu_id": fmu.id}

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

async def process_search(file: UploadFile, sensors_str: str, builder):
    """
    Handles image processing, context extraction, and filtered Qdrant search.
    """
    temp_filename = f"temp_search_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        sensor_data = json.loads(sensors_str)
        abs_image_path = os.path.abspath(temp_filename)

        # --- STEP 1: Context Extraction ---
        target_crop = sensor_data.get("crop")
        target_stage = sensor_data.get("stage")

        if not target_crop or not target_stage:
            return {"status": "error", "message": f"Missing crop/stage in: {sensor_data}"}

        print(f"🔎 Context: Searching for {target_crop} ({target_stage})...")

        # --- STEP 2: Separate Numeric Data vs Metadata ---
        numeric_sensors = {
            "pH": sensor_data.get("pH"),
            "EC": sensor_data.get("EC"),
            "temp": sensor_data.get("temp"),
            "humidity": sensor_data.get("humidity")
        }
        metadata = {"crop": target_crop, "stage": target_stage}

        # --- STEP 3: Create Filter ---
        context_filter = models.Filter(
            must=[
                models.FieldCondition(key="crop", match=models.MatchValue(value=target_crop)),
                models.FieldCondition(key="stage", match=models.MatchValue(value=target_stage))
            ]
        )

        # --- STEP 4: Generate Vector ---
        query_fmu = builder.create_fmu(abs_image_path, numeric_sensors, metadata=metadata)
        query_vector = query_fmu.vector.tolist() if hasattr(query_fmu.vector, 'tolist') else query_fmu.vector

        # --- STEP 5: Search ---
        try:
            response = client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                query_filter=context_filter,
                limit=5,
                with_payload=True
            )
            hits = response.points
        except Exception as filter_error:
            # Fallback for missing indexes
            if "Index required" in str(filter_error):
                print("⚠️ Index missing. Falling back to unfiltered search.")
                response = client.search(
                    collection_name=COLLECTION_NAME,
                    query_vector=query_vector,
                    limit=5,
                    with_payload=True
                )
                hits = response
            else:
                raise filter_error

        # Format Results
        results = [
            {"id": hit.id, "score": hit.score, "payload": hit.payload}
            for hit in hits
        ]
        return {"results": results}

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)