from mem0 import Memory
import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http import models

load_dotenv()

class FarmMemory:
    def __init__(self):
        # First, ensure the collection exists with correct dimensions
        self._setup_collection()
        
        self.memory = Memory.from_config({
            # 🟢 1. VECTOR STORE (Qdrant Cloud)
            "vector_store": {
                "provider": "qdrant",
                "config": {
                    "url": os.getenv("QDRANT_URL"),
                    "api_key": os.getenv("QDRANT_API_KEY"),
                    "collection_name": "Plant_Biographies_HF",  # Different collection for 384 dims
                    "port": 6333,
                }
            },
            # 🟢 2. LLM (Groq)
            "llm": {
                "provider": "groq",
                "config": {
                    "model": "llama-3.1-8b-instant",
                    "api_key": os.getenv("GROQ_API_KEY")
                }
            },
            # 🟢 3. EMBEDDER (HuggingFace - 384 dimensions)
            "embedder": {
                "provider": "huggingface",
                "config": {
                    "model": "all-MiniLM-L6-v2"  # 384 dimensions
                }
            }
        })
    
    def _setup_collection(self):
        """Create the collection with correct vector dimensions if it doesn't exist"""
        client = QdrantClient(
            url=os.getenv("QDRANT_URL"),
            api_key=os.getenv("QDRANT_API_KEY"),
        )
        
        collection_name = "Plant_Biographies_HF"
        
        try:
            # Check if collection exists
            client.get_collection(collection_name)
            print(f"✅ Collection '{collection_name}' already exists")
        except Exception:
            # Create collection with 384 dimensions
            print(f"📝 Creating collection '{collection_name}' with 384 dimensions...")
            client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=384,  # HuggingFace all-MiniLM-L6-v2 dimension
                    distance=models.Distance.COSINE
                )
            )
            print(f"✅ Collection created successfully")

    def get_plant_history(self, crop_id):
        """Retrieve the complete biographical history of a plant"""
        history = self.memory.search(
            query=f"What is the health history and past treatments for {crop_id}?", 
            user_id=crop_id
        )
        
        # Debug: Print the structure to see what we got
        print(f"🔍 Debug - History type: {type(history)}")
        # print(f"🔍 Debug - History content: {history}")
        
        if not history:
            return "No prior biographical records for this plant."
        
        # Handle different possible response structures
        try:
            # If history is a dict with 'results' key
            if isinstance(history, dict) and 'results' in history:
                results = history['results']
                formatted_history = "\n".join([f"- {item['memory']}" for item in results])
            # If history is already a list
            elif isinstance(history, list):
                # Each item might be a dict or a string
                formatted_lines = []
                for item in history:
                    if isinstance(item, dict):
                        # Try different possible keys
                        text = item.get('memory') or item.get('text') or item.get('content') or str(item)
                    else:
                        text = str(item)
                    formatted_lines.append(f"- {text}")
                formatted_history = "\n".join(formatted_lines)
            # If it's a string (single result)
            elif isinstance(history, str):
                formatted_history = f"- {history}"
            else:
                formatted_history = str(history)
            
            return formatted_history
            
        except Exception as e:
            print(f"⚠️ Error formatting history: {e}")
            return f"Error retrieving history: {str(e)}\nRaw data: {history}"

    def log_event(self, crop_id, event_text):
        """Log a new event in the plant's biography"""
        result = self.memory.add(event_text, user_id=crop_id)
        # print(f"🧠 Biography Updated for {crop_id}")
        # print(f"📝 Add result: {result}")

if __name__ == "__main__":
    print("🚀 Running Quick Memory Check...")
    
    # 1. Initialize
    mem = FarmMemory()
    test_id = "Debug_Plant_001"
    
    # 2. Write
    print(f"\n📝 Writing memory for {test_id}...")
    mem.log_event(test_id, "DIAGNOSIS: Plant shows signs of severe Nitrogen deficiency. Leaves are yellowing at the bottom.")
    
    # 3. Read
    print(f"\n📖 Reading back memory...")
    history = mem.get_plant_history(test_id)
    
    print("\n" + "="*50)
    print("--- PLANT BIOGRAPHY ---")
    print("="*50)
    print(history)
    print("="*50 + "\n")