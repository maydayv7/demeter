import sys
import os

# --- PATH FIX: Add project root to system path ---
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../'))
sys.path.append(project_root)
# -------------------------------------------------

import shutil
import json
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

from Sentinel.agent import FMUBuilder
from Qdrant.Store import store_fmu, COLLECTION_NAME # Import name to avoid typos
from Qdrant.Client import client # This imports your CLOUD connection
from Sentinel.Encoders.Vision import VisionEncoder

app = FastAPI()

# Allow connection from Next.js (port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the Builder
print("🌱 Initializing Demeter Agents...")
builder = FMUBuilder()
print("✅ Agents Ready.")

@app.post("/ingest")
async def ingest_fmu(
    file: UploadFile = File(...), 
    sensors: str = Form(...), 
    metadata: str = Form(...)
):
    """
    Endpoint to receive raw data, convert to FMU, and store in Qdrant.
    """
    print(f"📡 Ingest Request Received: {file.filename}")
    
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # 2. Parse JSON data from frontend
        sensor_data = json.loads(sensors)
        meta_data = json.loads(metadata)

        # 3. Create FMU (Uses Sentinel Logic)
        abs_image_path = os.path.abspath(temp_filename)
        fmu = builder.create_fmu(abs_image_path, sensor_data, meta_data)

        # 4. Store in Qdrant (Uses Memory Logic)
        store_fmu(fmu)
        
        return {"status": "success", "fmu_id": fmu.id}

    except Exception as e:
        print(f"❌ Error: {e}")
        return {"status": "error", "message": str(e)}

    finally:
        # 5. Cleanup
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

@app.post("/search")
async def search_fmu(
    file: UploadFile = File(...),
    sensors: str = Form(...)
):
    """
    Semantic Search:
    1. Receives Image + Sensor Data
    2. Uses FMUBuilder to create a 'Transient FMU' (Query Object)
    3. Uses that FMU's vector to find neighbors in Qdrant
    """
    temp_filename = f"temp_search_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        sensor_data = json.loads(sensors)
        abs_image_path = os.path.abspath(temp_filename)

        # 1. Create a "Query FMU"
        # We don't care about metadata for the query, just the vector
        query_fmu = builder.create_fmu(abs_image_path, sensor_data, metadata={})

        # 2. Search Qdrant using the FMU's vector
        print(f"🔎 Searching Cloud for matches...")
        
        # Convert numpy array to list if needed
        query_vector = query_fmu.vector.tolist() if hasattr(query_fmu.vector, 'tolist') else query_fmu.vector
        
        response = client.query_points(
            collection_name="Farm_Memory",
            query=query_vector,
            limit=5,
            with_payload=True
        )
        
        # Extract the points list from QueryResponse object
        hits = response.points
        
        # 3. Format results
        results = []
        for hit in hits:
            results.append({
                "id": hit.id,
                "score": hit.score,
                "payload": hit.payload
            })
            
        return {"results": results}

    except Exception as e:
        print(f"Search Error: {e}")
        return {"status": "error", "message": str(e)}

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)