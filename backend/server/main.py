import sys
import os

# --- PATH FIX ---
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../'))
sys.path.append(project_root)
# ----------------

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from Sentinel.agent import FMUBuilder

# Import the new logic functions
from backend.server.functions import process_ingest, process_search 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Agents Once
print("🌱 Initializing Demeter Agents...")
builder = FMUBuilder()
print("✅ Agents Ready.")

@app.post("/ingest")
async def ingest_endpoint(
    file: UploadFile = File(...), 
    sensors: str = Form(...), 
    metadata: str = Form(...)
):
    try:
        # Pass the builder instance to the route handler
        return await process_ingest(file, sensors, metadata, builder)
    except Exception as e:
        print(f"❌ Ingest Error: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/search")
async def search_endpoint(
    file: UploadFile = File(...),
    sensors: str = Form(...)
):
    try:
        return await process_search(file, sensors, builder)
    except Exception as e:
        print(f"❌ Search Error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)