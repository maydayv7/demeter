import sys
import os
import requests
import json
from pathlib import Path

# --- PATH FIX ---
# Ensures Python can find 'Sentinel' and 'Qdrant' folders
current_file = Path(__file__).resolve()
project_root = current_file.parent.parent
sys.path.append(str(project_root))
# ----------------

from qdrant_client import models
from Sentinel.agent import FMUBuilder
from Qdrant.Store import store_fmu, COLLECTION_NAME
from Qdrant.Client import client

# ==========================================
# 🕵️ HISTORIAN AGENT
# ==========================================
class HistorianAgent:
    def __init__(self):
        self.client = client  # Use the shared Qdrant client
        self.collection = COLLECTION_NAME

    def consult_history(self, fmu):
        """
        Takes an FMU, extracts its metadata/vector, and searches 
        for similar past instances with the same Crop & Stage.
        """
        target_crop = fmu.metadata.get("crop")
        target_stage = fmu.metadata.get("stage")

        print(f"\n[Historian] 📜 Consulting archives for {target_crop} ({target_stage})...")

        # 1. Create Context Filter
        context_filter = models.Filter(
            must=[
                models.FieldCondition(key="crop", match=models.MatchValue(value=target_crop)),
                models.FieldCondition(key="stage", match=models.MatchValue(value=target_stage))
            ]
        )

        # 2. Search Qdrant
        try:
            # We use the vector from the FMU directly
            results = self.client.search(
                collection_name=self.collection,
                query_vector=fmu.vector,
                query_filter=context_filter,
                limit=3,
                with_payload=True
            )
        except Exception as e:
            print(f"[Historian] ⚠️ Search Error: {e}. Trying unfiltered search...")
            # Fallback if filters fail (e.g. missing payload index)
            results = self.client.search(
                collection_name=self.collection,
                query_vector=fmu.vector,
                limit=3,
                with_payload=True
            )

        # 3. Report Results
        if not results:
            print("[Historian] 🤷 No similar history found.")
            return []

        print(f"[Historian] ✅ Found {len(results)} matches:")
        formatted_history = []
        for hit in results:
            print(f"   - ID: {hit.id} | Score: {hit.score:.4f}")
            formatted_history.append(hit.payload)
        
        return formatted_history


# ==========================================
# 📡 FETCHING AGENT
# ==========================================
class FetchingAgent:
    def __init__(self, simulator_url="https://unexhumed-melaine-bouncingly.ngrok-free.dev/simulation/state"):
        self.sim_url = simulator_url
        self.builder = FMUBuilder()

    def run_cycle(self):
        print(f"\n[Fetcher] 📡 Requesting data from {self.sim_url}...")
        
        try:
            response = requests.get(self.sim_url)
            
            if response.status_code != 200:
                print(f"[Fetcher] ❌ Error: Simulator returned {response.status_code}")
                return None

            data = response.json()

            # --- 1. Filter Sensors (pH, EC, Temp, Humidity) ---
            window_data = data.get("sensor_window", {})
            wanted_keys = {"ph": "pH", "ec": "EC", "humidity": "humidity", "temp": "temp", "air_temp": "temp"}
            
            sensor_snapshot = {}
            for key, value_list in window_data.items():
                key_lower = key.lower()
                if key_lower in wanted_keys:
                    out_name = wanted_keys[key_lower]
                    val = value_list[-1] if isinstance(value_list, list) and value_list else 0.0
                    if out_name not in sensor_snapshot:
                        sensor_snapshot[out_name] = val

            # --- 2. Filter Metadata (Crop, Stage) ---
            raw_meta = data.get("metadata", {})
            filtered_metadata = {
                "crop": raw_meta.get("crop", "unknown"),
                "stage": raw_meta.get("stage", "unknown")
            }

            # --- 3. Create FMU ---
            image_b64 = data.get("image", "")
            fmu = self.builder.create_fmu(image_b64, sensor_snapshot, filtered_metadata)
            
            print(f"[Fetcher] 🧠 FMU Created (ID: {fmu.id})")
            print(f"[Fetcher]    Sensors: {sensor_snapshot}")

            # --- 4. Store in DB ---
            store_fmu(fmu)
            
            return fmu

        except Exception as e:
            print(f"[Fetcher] ❌ Critical Error: {e}")
            return None


# ==========================================
# 🎬 LOCAL ORCHESTRATION
# ==========================================
if __name__ == "__main__":
    # 1. Instantiate Agents
    fetcher = FetchingAgent()
    historian = HistorianAgent()

    # 2. Run the Loop
    print("--- Starting Combined Agent Cycle ---")
    
    # Step A: Fetch & Process
    current_fmu = fetcher.run_cycle()

    # Step B: Consult History (if Fetch was successful)
    if current_fmu:
        historian.consult_history(current_fmu)