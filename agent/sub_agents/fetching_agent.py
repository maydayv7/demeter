import sys
import os
import requests
import json
from pathlib import Path

# --- PATH FIX ---
current_file = Path(__file__).resolve()
project_root = current_file.parent.parent.parent # Adjusted for sub_agents nesting
sys.path.append(str(project_root))
# ----------------

from qdrant_client import models
from Sentinel.agent import FMUBuilder
from Qdrant.Store import store_fmu, COLLECTION_NAME
from Qdrant.Client import client

class FetchingAgent:
    def __init__(self, simulator_url="https://unexhumed-melaine-bouncingly.ngrok-free.dev/simulation/state"):
        self.sim_url = simulator_url
        self.builder = FMUBuilder()

    def fetch_and_process(self):
        print(f"[Fetcher] 📡 Requesting data from {self.sim_url}...")
        
        try:
            response = requests.get(self.sim_url)
            
            if response.status_code == 200:
                data = response.json()
                
                # --- 1. EXTRACT RAW DATA ---
                window_data = data.get("sensor_window", {})
                image_b64 = data.get("image", "") 
                raw_meta = data.get("metadata", {})

                # --- 2. FILTER SENSORS (Strictly the 4 requested) ---
                wanted_keys = {
                    "ph": "pH",
                    "ec": "EC",
                    "humidity": "humidity",
                    "temp": "temp",
                    "air_temp": "temp"
                }

                sensor_snapshot = {}
                for key, value_list in window_data.items():
                    key_lower = key.lower()
                    if key_lower in wanted_keys:
                        out_name = wanted_keys[key_lower]
                        val = value_list[-1] if isinstance(value_list, list) and value_list else 0.0
                        if out_name not in sensor_snapshot:
                            sensor_snapshot[out_name] = val

                # --- 3. FILTER METADATA (Crop & Stage) ---
                filtered_metadata = {
                    "crop": raw_meta.get("crop", "unknown"),
                    "stage": raw_meta.get("stage", "unknown")
                }

                # --- 4. CREATE FMU ---
                fmu = self.builder.create_fmu(image_b64, sensor_snapshot, filtered_metadata)
                
                print(f"\n[Fetcher] 🧠 FMU Created (ID: {fmu.id})")
                print(f"[Fetcher]    Sensors: {sensor_snapshot}")
                
                # --- 5. STORE IN QDRANT ---
                store_fmu(fmu)

                # --- 6. HISTORIAN SEARCH (Integrated) ---
                search_results = self.find_similar_instances(fmu)
                
                print(f"[Historian] 📜 Found {len(search_results)} similar past events.")
                
                # RETURN EVERYTHING THE ORCHESTRATOR NEEDS
                return fmu, sensor_snapshot, search_results
            else:
                print(f"[Fetcher] ❌ Error: Simulator returned {response.status_code}")
                return None, None, None

        except Exception as e:
            print(f"[Fetcher] ❌ Critical Error: {e}")
            import traceback
            traceback.print_exc()
            return None, None, None

    def find_similar_instances(self, current_fmu):
        """
        Uses the current FMU's vector and metadata to filter and search Qdrant.
        """
        target_crop = current_fmu.metadata.get("crop")
        target_stage = current_fmu.metadata.get("stage")
        
        # Create Filter
        context_filter = models.Filter(
            must=[
                models.FieldCondition(key="crop", match=models.MatchValue(value=target_crop)),
                models.FieldCondition(key="stage", match=models.MatchValue(value=target_stage))
            ]
        )

        try:
            # Use the vector we just generated
            response = client.search(
                collection_name=COLLECTION_NAME,
                query_vector=current_fmu.vector,
                query_filter=context_filter,
                limit=5,
                with_payload=True
            )
            return [{"id": hit.id, "score": hit.score, "payload": hit.payload} for hit in response]
            
        except Exception as e:
            print(f"⚠️ Search Warning: {e}. Returning empty history.")
            return []

if __name__ == "__main__":
    agent = FetchingAgent()
    agent.fetch_and_process()