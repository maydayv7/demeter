import logging
from mem0 import Memory
import os
import time  # <--- IMPORT ADDED
from dotenv import load_dotenv
from qdrant_client import QdrantClient, models

load_dotenv()

logging.getLogger("mem0").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)

class FarmMemory:
    def __init__(self):
        # 1. Setup Collection
        self._setup_collection()
        
        # 2. Initialize Mem0
        config = {
            "vector_store": {
                "provider": "qdrant",
                "config": {
                    "url": os.getenv("QDRANT_URL"),
                    "api_key": os.getenv("QDRANT_API_KEY"),
                    "collection_name": "Plant_Biographies_HF",
                    "port": 6333,
                }
            },
            "llm": {
                "provider": "openai",
                "config": {
                    "model": "qwen/qwen3-32b",
                    "api_key": os.getenv("GROQ_API_KEY"),
                    "openai_base_url": "https://api.groq.com/openai/v1",
                    "max_tokens": 1500
                }
            },
            "embedder": {
                "provider": "huggingface",
                "config": {
                    "model": "all-MiniLM-L6-v2"
                }
            }
        }
        
        print("🧠 Initializing FarmMemory...")
        self.memory = Memory.from_config(config)
    
    def _setup_collection(self):
        """Create the collection manually to guarantee dimension match"""
        try:
            client = QdrantClient(
                url=os.getenv("QDRANT_URL"),
                api_key=os.getenv("QDRANT_API_KEY"),
                timeout=30 
            )
            
            collection_name = "Plant_Biographies_HF"
            
            if client.collection_exists(collection_name):
                print(f"✅ Collection '{collection_name}' verified.")
            else:
                print(f"📝 Creating '{collection_name}' (384 dims)...")
                client.create_collection(
                    collection_name=collection_name,
                    vectors_config=models.VectorParams(
                        size=384, 
                        distance=models.Distance.COSINE
                    )
                )
                print(f"✅ Collection created.")
        except Exception as e:
            print(f"⚠️ Collection setup warning: {e}")

    def get_plant_history(self, crop_id, limit=3):
        """Retrieve the last N chronological entries for a crop"""
        try:
            print(f"🔍 [FarmMemory] Fetching last {limit} entries for: {crop_id}...")
            
            # 1. Use get_all() to fetch raw history (bypassing vector similarity)
            # This ensures we get the *actual* latest events, not just "relevant" ones
            history = self.memory.get_all(user_id=crop_id)
         #   print(f"   -> Raw history count: {history}")


            
            # 2. Extract List from response
            results = []
            if isinstance(history, dict):
                results = history.get("results", [])
            elif isinstance(history, list):
                results = history
            
            if not results:
                return f"No biography found for {crop_id}."

            # 3. Sort by 'created_at' (Descending) to get Newest -> Oldest
            # Safe sort: defaults to empty string if 'created_at' is missing
            results.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            
            # 4. Slice the top N (Past 3)
            recent_results = results[:limit]

       #     print(f"   -> Extracted entries: {results}")
            
            # 5. Format the output
            formatted_lines = []
            for item in recent_results:
                # Handle different mem0 versions where content might be in 'memory' or 'text'
                text = item.get("memory", item.get("text", str(item)))
          #      print(f"   -> Processing entry: {text}")
                
                # Optional: Add a timestamp to the output for verification
                timestamp = item.get("created_at", "")
                if timestamp:
                    # Cleanup timestamp for readability (e.g., 2024-02-09T10:00:00 -> 2024-02-09 10:00)
                    timestamp = timestamp.replace("T", " ").split(".")[0]
                    formatted_lines.append(f"[{timestamp}] {text}")
                else:
                    formatted_lines.append(f"- {text}")
            
            clean_output = "\n".join(formatted_lines)

        #    print(f"   -> Formatted Output:\n{clean_output}")
            return clean_output

        except Exception as e:
            print(f"❌ [FarmMemory] Error: {e}")
            return f"Error retrieving history: {str(e)}"

    def log_event(self, crop_id, event_text):
        """Log a new event in the plant's biography"""
        try:
            # Capture the result to check if LLM extracted it correctly
            result = self.memory.add(event_text, user_id=crop_id)
            print(f"🧠 Biography Updated for {crop_id}")
        except Exception as e:
            print(f"❌ Memory Write Error: {e}")


# execute
if __name__ == "__main__":
    farm_memory = FarmMemory()
    print("\n✅ System Online.\n")

    # 1. WRITE: Manually log a test event
    test_crop = "BATCH-VERDANT-X1"
    # print(f"📝 Logging event for {test_crop}...")
    farm_memory.log_event(test_crop, "CRITICAL TEST: Detected mild nutrient burn. Flushed system with pH 5.8 water.")

    # CRITICAL FIX: Wait for Vector DB indexing
    print("⏳ Waiting for memory indexing...")
    time.sleep(2) 

    # 2. READ: Fetch it back
    print(f"\n🔍 Retrieving history for {test_crop}...")
    history = farm_memory.get_plant_history(test_crop)
    
    print("-" * 40)
    print(f"MEMORY OUTPUT:\n{history}")
    print("-" * 40)