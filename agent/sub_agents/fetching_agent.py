import requests
import json
from Sentinel.agent import FMUBuilder
from tools.db_tools import DBTools # Assuming you have the DB tool from previous steps

class FetchingAgent:
    def __init__(self, simulator_url="https://unexhumed-melaine-bouncingly.ngrok-free.dev/simulation/state"):
        self.sim_url = simulator_url
        self.builder = FMUBuilder()
        self.db = DBTools() 

    def fetch_and_process(self):
        print(f"[Fetcher] 📡 Requesting data from {self.sim_url}...")
        
        try:
            # 1. GET Request to Simulator
            # Expecting JSON: { "sensors": {...}, "image": "base64...", "metadata": {...} }
            response = requests.get(self.sim_url)
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract Data
                sensors = data.get("sensors", {})
                image_b64 = data.get("image", "") # Expecting pure Base64 string
                metadata = data.get("metadata", {})

                print(f"[Fetcher] ✅ Data received. Sensors: {sensors}")

                # 2. Create Vector & FMU (Using Base64)
                fmu = self.builder.create_fmu(image_b64, sensors, metadata)
                print(f"[Fetcher] 🧠 FMU Created (ID: {fmu.id})")

                # 3. Store in Database (Optional step here, or return to Orchestrator)
                self.db.store_fmu(fmu)
                
                return fmu
            else:
                print(f"[Fetcher] ❌ Error: Simulator returned {response.status_code}")
                return None

        except Exception as e:
            print(f"[Fetcher] ❌ Connection Failed: {e}")
            return None

# --- Quick Test ---
if __name__ == "__main__":
    # Mocking a server response for testing logic without a real server
    from unittest.mock import MagicMock
    
    agent = FetchingAgent()
    
    # Mock request
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "sensors": {"pH": 5.9, "EC": 1.3, "temp": 25.0, "humidity": 72.0},
        "metadata": {"crop": "lettuce", "stage": "vegetative"},
        # A tiny white pixel in Base64
        "image": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg=="
    }
    requests.get = MagicMock(return_value=mock_response)
    
    agent.fetch_and_process()