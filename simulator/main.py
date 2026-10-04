import base64
import os
import uvicorn
import numpy as np
import torch
from io import BytesIO
from collections import deque
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from PIL import Image
from dotenv import load_dotenv
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import ConfigurationError
from datetime import datetime

# Load env from root
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, "..", ".env")
load_dotenv(env_path)

MONGO_URI = os.environ.get("MONGODB_URI")
mongo_client = MongoClient(MONGO_URI)
try:
    db = mongo_client.get_default_database()
except ConfigurationError:
    db = mongo_client["test"]
crops_collection = db["cropstates"]
sim_state_collection = db["simulator_state"]

print(f"[DEBUG] MongoDB connected to DB: '{db.name}'")
print(f"[DEBUG] MONGO_URI = {MONGO_URI[:40] if MONGO_URI else 'NOT SET'}...")

crops_collection = db["cropstates"]
sim_state_collection = db["simulation_state"]

MODEL_PATH = "models/PPO/lettuce_brain_v1.zip"
HISTORY_LEN = 20

CROP_LIFECYCLES = {
    "lettuce": {
        "stages": [
            {"name": "seedling", "end_hour": 168},
            {"name": "vegetative", "end_hour": 504},
            {"name": "harvest", "end_hour": 999999},
        ]
    },
    "tomato": {
        "stages": [
            {"name": "seedling", "end_hour": 336},
            {"name": "vegetative", "end_hour": 1008},
            {"name": "flowering", "end_hour": 1680},
            {"name": "fruiting", "end_hour": 999999},
        ]
    },
    "basil": {
        "stages": [
            {"name": "seedling", "end_hour": 168},
            {"name": "vegetative", "end_hour": 672},
            {"name": "harvest", "end_hour": 999999},
        ]
    },
    "strawberry": {
        "stages": [
            {"name": "seedling", "end_hour": 336},
            {"name": "vegetative", "end_hour": 1008},
            {"name": "flowering", "end_hour": 1512},
            {"name": "fruiting", "end_hour": 999999},
        ]
    },
}


class FarmAction(BaseModel):
    acid_dosage_ml: float = 0.0
    base_dosage_ml: float = 0.0
    nutrient_dosage_ml: float = 0.0
    fan_speed_pct: float = 0.0
    water_refill_l: float = 0.0
    debug_force_ph: float | None = None


class BatchActionRequest(BaseModel):
    crop_id: str
    action: FarmAction


class ResidualPhysicsNet(torch.nn.Module):
    def __init__(self, state_dim, action_dim):
        super().__init__()
        self.net = torch.nn.Sequential(
            torch.nn.Linear(state_dim + action_dim, 64),
            torch.nn.Tanh(),
            torch.nn.Linear(64, 64),
            torch.nn.ReLU(),
            torch.nn.Linear(64, state_dim),
        )

    def forward(self, state, action):
        x = torch.cat([state, action], dim=-1)
        return self.net(x)


class DigitalTwin:
    def __init__(self, crop_id: str, initial_state: list):
        self.crop_id = crop_id
        self.state = np.array(initial_state, dtype=np.float32)
        self.tank_volume = 100.0
        self.plant_health = 100.0
        self.residual_model = ResidualPhysicsNet(7, 4)
        
        # Try to load trained weights
        trained_weights_path = os.path.join(current_dir, "residual_physics.pt")
        if os.path.exists(trained_weights_path):
            try:
                checkpoint = torch.load(trained_weights_path, map_location="cpu")
                self.residual_model.load_state_dict(checkpoint["model_state_dict"])
                print(f"[DEBUG] Loaded trained ResidualPhysicsNet weights from {trained_weights_path}")
            except Exception as e:
                print(f"[WARNING] Failed to load trained weights: {e}. Using random initialization.")
        else:
            print(f"[DEBUG] Trained weights not found at {trained_weights_path}. Using random initialization.")

        self.history = {
            "ph": deque([float(self.state[0])] * 5, maxlen=HISTORY_LEN),
            "ec": deque([float(self.state[1])] * 5, maxlen=HISTORY_LEN),
            "water_temp": deque([float(self.state[2])] * 5, maxlen=HISTORY_LEN),
            "air_temp": deque([float(self.state[3])] * 5, maxlen=HISTORY_LEN),
            "humidity": deque([float(self.state[4])] * 5, maxlen=HISTORY_LEN),
            "co2": deque([400.0] * 5, maxlen=HISTORY_LEN),
            "light_intensity": deque([0.0] * 5, maxlen=HISTORY_LEN),
            "vpd": deque([float(self.state[5])] * 5, maxlen=HISTORY_LEN),
        }

    def _calculate_vpd(self, temp, hum):
        es = 0.61078 * np.exp((17.27 * temp) / (temp + 237.3))
        ea = es * (hum / 100.0)
        return max(0.0, es - ea)

    def step(self, action: FarmAction = None):
        if action is None:
            action = FarmAction()

        u = np.array(
            [
                action.acid_dosage_ml / 10.0,
                action.base_dosage_ml / 10.0,
                action.nutrient_dosage_ml / 20.0,
                action.fan_speed_pct / 100.0,
            ],
            dtype=np.float32,
        )

        ph, ec, wt, at, hum, vpd, bio = self.state

        d_ph = (u[1] * 0.5) - (u[0] * 0.5) + (0.001 * bio)
        if action.debug_force_ph:
            self.state[0] = action.debug_force_ph

        uptake = 0.02 * bio * vpd
        d_ec = (u[2] * 0.2) - (uptake / self.tank_volume)
        d_at = 0.1 - (u[3] * 1.5)
        d_hum = 1.0 - (u[3] * 5.0)

        stress = abs(vpd - 1.0)
        growth = 0.1 * bio * (1.0 - min(stress, 1.0))

        physics_delta = np.array(
            [d_ph, d_ec, 0, d_at, d_hum, 0, growth], dtype=np.float32
        )

        with torch.no_grad():
            nn_delta = self.residual_model(
                torch.tensor(self.state), torch.tensor(u)
            ).numpy()

        self.state += physics_delta + (nn_delta * 0.05)
        self.state[0] = np.clip(self.state[0], 0, 14)
        self.state[3] = np.clip(self.state[3], 0, 50)
        self.state[4] = np.clip(self.state[4], 0, 100)
        self.state[5] = self._calculate_vpd(self.state[3], self.state[4])
        self.state[6] = max(0.1, self.state[6])

        ph_score = max(0, 1.0 - abs(self.state[0] - 6.0))
        vpd_score = max(0, 1.0 - abs(self.state[5] - 1.0))
        self.plant_health = max(
            0.0, min(100.0, (float(ph_score) + float(vpd_score)) * 50.0)
        )

        self._update_history()
        return self._generate_image()

    def _update_history(self):
        s = self.state
        self.history["ph"].append(float(s[0]))
        self.history["ec"].append(float(s[1]))
        self.history["water_temp"].append(float(s[2]))
        self.history["air_temp"].append(float(s[3]))
        self.history["humidity"].append(float(s[4]))
        self.history["vpd"].append(float(s[5]))

    def _generate_image(self):
        bucket = max(0, min(90, int(self.plant_health // 10) * 10))
        filename = f"{bucket}.png"
        if os.path.exists(filename):
            return Image.open(filename)
        return Image.new("RGB", (512, 512), (50, 50, 50))


app = FastAPI()
simulators = {}


def sync_simulators_from_db():
    db_crops = crops_collection.find({})
    for crop in db_crops:
        cid = crop.get("crop_id")
        if not cid:
            continue

        if cid not in simulators:
            sensors = crop.get("sensors", {})

            ph_val = sensors.get("pH", [6.0])
            ec_val = sensors.get("EC", [1.5])
            temp_val = sensors.get("temp", [24.0])
            hum_val = sensors.get("humidity", [60.0])

            state = [
                ph_val[-1] if isinstance(ph_val, list) else ph_val,
                ec_val[-1] if isinstance(ec_val, list) else ec_val,
                20.0,
                temp_val[-1] if isinstance(temp_val, list) else temp_val,
                hum_val[-1] if isinstance(hum_val, list) else hum_val,
                1.0,
                10.0,
            ]
            simulators[cid] = DigitalTwin(cid, state)


@app.get("/simulation/state")
async def get_all_states():
    clock = sim_state_collection.find_one_and_update(
        {"_id": "global_clock"},
        {"$inc": {"tick_hours": 10}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    current_tick = clock["tick_hours"]

    crops_collection.update_many({}, {"$inc": {"simulated_age_hours": 10}})

    sync_simulators_from_db()

    db_crops = list(crops_collection.find({}))
    response = []

    for crop in db_crops:
        cid = crop.get("crop_id")
        if not cid:
            continue
        if cid not in simulators:
            continue

        crop_type = crop.get("crop", "lettuce").lower()
        age_hours = crop.get("sequence_number", 0) * crop.get("cycle_duration_hours", 1)

        print(f"Simulating Crop ID: {cid} | Type: {crop_type} | Age (hrs): {age_hours}")
        cycle_duration = crop.get("cycle_duration_hours", 1)

        new_stage = crop.get("stage", "seedling")
        if crop_type in CROP_LIFECYCLES:
            for stage_info in CROP_LIFECYCLES[crop_type]["stages"]:
                if age_hours <= stage_info["end_hour"]:
                    new_stage = stage_info["name"]
                    break

        if new_stage != crop.get("stage"):
            crops_collection.update_one(
                {"crop_id": cid}, {"$set": {"stage": new_stage}}
            )

        print(
            f" current_tick: {current_tick} | crop_id: {cid} | age_hours: {age_hours} | stage: {new_stage} | cycle_duration: {cycle_duration}"
        )

        if current_tick % cycle_duration != 0 and current_tick != 1:
            continue

        sim = simulators[cid]
        pil_img = sim._generate_image()
        buf = BytesIO()
        pil_img.save(buf, format="PNG")
        img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        response.append(
            {
                "crop_id": cid,
                "sensor_window": {k: list(v) for k, v in sim.history.items()},
                "metadata": {
                    "crop": crop_type,
                    "stage": new_stage,
                    "health": round(float(sim.plant_health), 1),
                    "biomass_est": round(float(sim.state[6]), 2),
                    "age_hours": age_hours,
                    "global_tick": current_tick,
                },
                "image": img_b64,
            }
        )

    return response


@app.post("/simulation/action")
async def take_batch_actions(payload: List[BatchActionRequest]):
    sync_simulators_from_db()

    results = []
    for req in payload:
        cid = req.crop_id
        if cid not in simulators:
            results.append(
                {"crop_id": cid, "status": "error", "message": "Crop not found"}
            )
            continue

        sim = simulators[cid]
        sim.step(req.action)

        push_payload = {
            "sensors.pH": {"$each": [float(sim.state[0])], "$slice": -5},
            "sensors.EC": {"$each": [float(sim.state[1])], "$slice": -5},
            "sensors.temp": {"$each": [float(sim.state[3])], "$slice": -5},
            "sensors.humidity": {"$each": [float(sim.state[4])], "$slice": -5},
        }

        set_payload = {
            "action_taken": req.action.dict(),
            "last_updated": datetime.utcnow(),
        }

        crops_collection.update_one(
            {"crop_id": cid},
            {
                "$push": push_payload,
                "$set": set_payload,
                "$inc": {"sequence_number": 1},
            },
        )

        results.append(
            {
                "crop_id": cid,
                "status": "success",
                "new_state": {
                    "pH": float(sim.state[0]),
                    "EC": float(sim.state[1]),
                    "temp": float(sim.state[3]),
                    "humidity": float(sim.state[4]),
                },
            }
        )

    return {"updated_crops": results}


if __name__ == "__main__":
    port = int(os.environ.get("SIMULATOR_PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
