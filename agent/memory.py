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
            # print(f"✅ Collection '{collection_name}' already exists")
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
        try:
            history = self.memory.search(
                query=f"What is the health history and past treatments for {crop_id}?", 
                user_id=crop_id
            )
            
            if not history:
                return "No prior biographical records for this plant."
            
            # Handle different possible response structures from mem0
            if isinstance(history, dict) and 'results' in history:
                results = history['results']
                return "\n".join([f"- {item['memory']}" for item in results])
            elif isinstance(history, list):
                formatted_lines = []
                for item in history:
                    text = item.get('memory', str(item)) if isinstance(item, dict) else str(item)
                    formatted_lines.append(f"- {text}")
                return "\n".join(formatted_lines)
            
            return str(history)
            
        except Exception as e:
            print(f"⚠️ Error formatting history: {e}")
            return f"Error retrieving history: {str(e)}"

    def log_event(self, crop_id, event_text):
        """Log a new event in the plant's biography"""
        try:
            self.memory.add(event_text, user_id=crop_id)
            print(f"🧠 Biography Updated for {crop_id}")
        except Exception as e:
            print(f"❌ Memory Write Error: {e}")