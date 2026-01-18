import sys
import os
import base64

# --- PATH FIX ---
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../'))
sys.path.append(project_root)
# ----------------

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from Sentinel.agent import FMUBuilder

# Import the logic functions
from backend.server.functions import process_ingest, process_search, process_text_query
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

# (Helper function removed as it is no longer needed for these endpoints)

@app.post("/ingest")
async def ingest_endpoint(
    file: UploadFile = File(...), 
    sensors: str = Form(...), 
    metadata: str = Form(...)
):
    try:
        # FIX: Pass the 'file' object directly. Do NOT convert to base64 string.
        return await process_ingest(file, sensors, metadata, builder)
    except Exception as e:
        print(f"❌ Ingest Error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.post("/search")
async def search_endpoint(
    file: UploadFile = File(...),
    sensors: str = Form(...)
):
    try:
        # FIX: Pass the 'file' object directly.
        return await process_search(file, sensors, builder)
    except Exception as e:
        print(f"❌ Search Error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.post("/query-text")
async def text_query_endpoint(query: str = Form(...)):
    return await process_text_query(query)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)