import uuid
from datetime import datetime
import numpy as np

from Sentinel.Encoders.Vision import VisionEncoder
from Sentinel.Encoders.TimeSeries import SensorEncoder
from Sentinel.fmu import FMU
from Qdrant.Store import store_fmu

class FMUBuilder:
    def __init__(self):
        self.vision = VisionEncoder()
        self.sensors = SensorEncoder()

    def create_fmu(self, image_path, sensor_data, metadata=None):
        img_vec = self.vision.encode(image_path)
        sensor_vec = self.sensors.encode(sensor_data)

        fmu_vector = np.concatenate([img_vec, sensor_vec]).tolist()

        return FMU(
            id=str(uuid.uuid4()),
            vector=fmu_vector,
            metadata={
                **(metadata or {}),
                "timestamp": datetime.utcnow().isoformat()
            }
        )

if __name__ == "__main__":
    builder = FMUBuilder()

    sensors = {
        "pH": 5.9,
        "EC": 1.3,
        "temp": 25.0,
        "humidity": 72.0
    }

    fmu = builder.create_fmu("Sentinel/Sample.png", sensors, {
        "crop": "lettuce",
        "stage": "vegetative"
    })

    print("FMU ID:", fmu.id)
    print("Vector length:", len(fmu.vector))
    print("Metadata:", fmu.metadata)

    store_fmu(fmu)