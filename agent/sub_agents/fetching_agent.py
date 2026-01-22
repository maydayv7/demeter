import sys
import os
import requests
from pathlib import Path

current_file = Path(__file__).resolve()
project_root = current_file.parent.parent.parent 
sys.path.append(str(project_root))

from qdrant_client import models
from Sentinel.agent import FMUBuilder
from Qdrant.Store import COLLECTION_NAME
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
                
                # 1. Extract Data
                window_data = data.get("sensor_window", {})
                image_b64 = data.get("image", "") 
                raw_meta = data.get("metadata", {})

                # 2. Filter Sensors
                wanted_keys = {"ph": "pH", "ec": "EC", "humidity": "humidity", "temp": "temp", "air_temp": "temp"}
                sensor_snapshot = {}
                for key, value_list in window_data.items():
                    key_lower = key.lower()
                    if key_lower in wanted_keys:
                        out_name = wanted_keys[key_lower]
                        val = value_list[-1] if isinstance(value_list, list) and value_list else 0.0
                        sensor_snapshot[out_name] = val

                # 3. Calculate Sequence & Prepare Metadata
                crop_id = raw_meta.get("crop_id", "UNKNOWN_CROP")
                next_seq = self._get_next_sequence(crop_id)
                print(f"[Fetcher] 🔢 Sequence for {crop_id}: {next_seq}")

                filtered_metadata = {
                    "crop": raw_meta.get("crop", "unknown"),
                    "stage": raw_meta.get("stage", "unknown"),
                    "crop_id": crop_id,
                    "sequence_number": next_seq,
                    # Store raw image for JudgeAgent (since we don't save to disk)
                    "image_b64": image_b64 
                }

                # 4. Create FMU (BUT DO NOT STORE)
                fmu = self.builder.create_fmu(image_b64, sensor_snapshot, filtered_metadata)
                
                print(f"[Fetcher] 🧠 FMU Created (ID: {fmu.id}) - Handing off to Judge.")
                
                # 5. Historian Search (Optional context for Researcher)
                search_results = self.find_similar_instances(fmu)
                
                return fmu, sensor_snapshot, search_results
            else:
                print(f"[Fetcher] ❌ Error: Simulator returned {response.status_code}")
                return None, None, None

        except Exception as e:
            print(f"[Fetcher] ❌ Critical Error: {e}")
            return None, None, None

    def _get_next_sequence(self, crop_id):
        """Queries Qdrant for count of existing points for this crop_id."""
        try:
            count_filter = models.Filter(
                must=[models.FieldCondition(key="crop_id", match=models.MatchValue(value=crop_id))]
            )
            count_result = client.count(collection_name=COLLECTION_NAME, count_filter=count_filter)
            return count_result.count + 1
        except Exception:
            return 1

    def find_similar_instances(self, current_fmu):
        try:
            # Simple similarity search (excluding current crop to avoid bias if needed)
            hits = client.search(
                collection_name=COLLECTION_NAME,
                query_vector=current_fmu.vector,
                limit=3,
                with_payload=True
            )
            return [{"payload": hit.payload} for hit in hits]
        except Exception:
            return []