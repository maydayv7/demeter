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

async def file_to_base64(file: UploadFile) -> str:
    """Convert uploaded file to base64 string"""
    contents = await file.read()
    base64_string = base64.b64encode(contents).decode('utf-8')
    await file.seek(0)  # Reset file pointer in case it's needed again
    return base64_string

@app.post("/ingest")
async def ingest_endpoint(
    file: UploadFile = File(...), 
    sensors: str = Form(...), 
    metadata: str = Form(...)
):
    try:
        # Convert file to base64
        image_base64 = await file_to_base64(file)
        # Pass the base64 string to the process function
        return await process_ingest(image_base64, sensors, metadata, builder)
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
        # Convert file to base64
        image_base64 = await file_to_base64(file)
        # Pass the base64 string to the process function
        return await process_search(image_base64, sensors, builder)
    except Exception as e:
        print(f"❌ Search Error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)