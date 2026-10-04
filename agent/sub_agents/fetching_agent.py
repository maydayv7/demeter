import sys
import os
import requests
from pathlib import Path
import base64
from io import BytesIO
from PIL import Image

current_file = Path(__file__).resolve()
project_root = current_file.parent.parent.parent
sys.path.append(str(project_root))

from qdrant_client import models
from Sentinel.agent import FMUBuilder
from Qdrant.Store import COLLECTION_NAME
from Qdrant.Client import client

class FetchingAgent:
    def __init__(self, simulator_url=None):
        if simulator_url is None:
            simulator_url = os.environ.get(
                "SIMULATOR_STATE_URL", "http://localhost:8001/simulation/state"
            )
        self.sim_url = simulator_url
        self.builder = FMUBuilder()

    def fetch_and_process(self):
        print(f"[Fetcher] 📡 Requesting data from {self.sim_url}...")

        try:
            response = requests.get(self.sim_url)

            if response.status_code == 200:
                data_list = response.json()
                
                if not isinstance(data_list, list):
                    data_list = [data_list]

                processed_crops = []

                for data in data_list:
                    window_data = data.get("sensor_window", {})
                    image_b64 = data.get("image", "")
                    raw_meta = data.get("metadata", {})

                    if not image_b64:
                        img = Image.new("RGB", (512, 512), (50, 50, 50))
                        buf = BytesIO()
                        img.save(buf, format="PNG")
                        image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

                    wanted_keys = {
                        "ph": "pH",
                        "ec": "EC",
                        "humidity": "humidity",
                        "temp": "temp",
                        "air_temp": "temp",
                    }
                    sensor_snapshot = {}
                    for key, value_list in window_data.items():
                        key_lower = key.lower()
                        if key_lower in wanted_keys:
                            out_name = wanted_keys[key_lower]
                            val = (
                                value_list[-1]
                                if isinstance(value_list, list) and value_list
                                else 0.0
                            )
                            sensor_snapshot[out_name] = val

                    crop_id = raw_meta.get("crop_id", data.get("crop_id", "UNKNOWN_CROP"))
                    next_seq = self._get_next_sequence(crop_id)

                    filtered_metadata = {
                        "crop": raw_meta.get("crop", "unknown"),
                        "stage": raw_meta.get("stage", "unknown"),
                        "crop_id": crop_id,
                        "sequence_number": next_seq,
                        "image_b64": image_b64,
                    }

                    fmu = self.builder.create_fmu(
                        image_b64, sensor_snapshot, filtered_metadata
                    )

                    search_results = self.find_similar_instances(fmu)

                    processed_crops.append({
                        "crop_id": crop_id,
                        "fmu": fmu,
                        "sensor_snapshot": sensor_snapshot,
                        "history": search_results,
                        "image_b64": image_b64
                    })

                return processed_crops
            else:
                return []

        except Exception:
            return []

    def _get_next_sequence(self, crop_id):
        try:
            count_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="crop_id", match=models.MatchValue(value=crop_id)
                    )
                ]
            )
            count_result = client.count(
                collection_name=COLLECTION_NAME, count_filter=count_filter
            )
            return count_result.count + 1
        except Exception:
            return 1

    def find_similar_instances(self, current_fmu):
        try:
            hits = client.search(
                collection_name=COLLECTION_NAME,
                query_vector=current_fmu.vector,
                limit=3,
                with_payload=True,
            )
            return [{"payload": hit.payload} for hit in hits]
        except Exception:
            return []