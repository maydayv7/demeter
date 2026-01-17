import json
from qdrant_client.http import models
from Qdrant.Store import store_fmu, COLLECTION_NAME
from Qdrant.Client import client

async def process_ingest(image_base64: str, sensors_str: str, metadata_str: str, builder):
    """
    Handles FMU creation and storage logic using base64 image.
    No more temporary files!
    """
    try:
        # 1. Parse Data
        sensor_data = json.loads(sensors_str)
        meta_data = json.loads(metadata_str)

        # 2. Create FMU directly from base64
        print(f"📡 Creating FMU from base64 image...")
        fmu = builder.create_fmu(image_base64, sensor_data, meta_data)

        # 3. Store in Cloud
        store_fmu(fmu)
        print(f"✅ FMU stored successfully: {fmu.id}")
        return {"status": "success", "fmu_id": fmu.id}

    except Exception as e:
        print(f"❌ Ingest processing error: {e}")
        raise

async def process_search(image_base64: str, sensors_str: str, builder):
    """
    Handles image processing, context extraction, and filtered Qdrant search.
    Uses base64 image instead of temporary files.
    """
    try:
        sensor_data = json.loads(sensors_str)

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

        # --- STEP 4: Generate Vector from base64 ---
        print(f"🧠 Generating query vector from base64 image...")
        query_fmu = builder.create_fmu(image_base64, numeric_sensors, metadata=metadata)
        query_vector = query_fmu.vector.tolist() if hasattr(query_fmu.vector, 'tolist') else query_fmu.vector

        # --- STEP 5: Search ---
        try:
            print(f"🔍 Searching Qdrant with filters...")
            response = client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                query_filter=context_filter,
                limit=5,
                with_payload=True
            )
            hits = response.points
            print(f"✅ Found {len(hits)} matches")
        except Exception as filter_error:
            # Fallback for missing indexes
            if "Index required" in str(filter_error):
                print("⚠️ Payload indexes missing. Falling back to unfiltered search.")
                print("💡 Run 'python create_indexes.py' to enable filtered searches.")
                response = client.search(
                    collection_name=COLLECTION_NAME,
                    query_vector=query_vector,
                    limit=5,
                    with_payload=True
                )
                hits = response.points
            else:
                raise filter_error

        # Format Results
        results = [
            {"id": hit.id, "score": hit.score, "payload": hit.payload}
            for hit in hits
        ]
        return {"results": results}

    except Exception as e:
        print(f"❌ Search processing error: {e}")
        raise