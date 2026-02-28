import sys
import os

# --- PATH FIX: Add project root to system path ---
# This allows server.py to "see" the Qdrant and Sentinel folders two levels up.
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../'))
sys.path.append(project_root)
# -------------------------------------------------

import shutil
import json
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

from Sentinel.agent import FMUBuilder
from Qdrant.Store import store_fmu
from Qdrant.Client import QdrantClient
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

# Initialize Agents
print("🌱 Initializing Demeter Agents...")
try:
    builder = FMUBuilder()
    client = QdrantClient(url="http://localhost:6333")
    vision = VisionEncoder()
    print("✅ Agents Ready.")
except Exception as e:
    print(f"⚠️ Initialization Warning: {e}")
    print("Ensure Qdrant is running on port 6333")

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
    
    # 1. Save Image Temporarily
    # We save it in the current directory (backend/server) temporarily
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # 2. Parse JSON data from frontend
        sensor_data = json.loads(sensors)
        meta_data = json.loads(metadata)

        # 3. Create FMU (Uses Sentinel Logic)
        # We pass the absolute path to ensure Sentinel can find the file
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
async def search_image(file: UploadFile = File(...)):
    """
    Endpoint to find similar past FMUs based on visual similarity.
    """
    temp_filename = f"temp_search_{file.filename}"
    
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # 1. Encode image to vector
        abs_image_path = os.path.abspath(temp_filename)
        vector = vision.encode(abs_image_path)
        
        # 2. Search Qdrant
        hits = client.search(
            collection_name="farm_memory",
            query_vector=vector.tolist(),
            limit=5
        )
        
        results = []
        for hit in hits:
            results.append({
                "score": hit.score,
                "payload": hit.payload
            })
            
        return {"results": results}

    except Exception as e:
        print(f"❌ Search Error: {e}")
        return {"status": "error", "message": str(e)}

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

if __name__ == "__main__":
    import uvicorn
    # Host 0.0.0.0 allows external access, Port 8000 is standard for API
    uvicorn.run(app, host="0.0.0.0", port=8000)