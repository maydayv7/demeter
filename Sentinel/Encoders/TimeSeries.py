# encoders/sensor_encoder.py
import numpy as np

class SensorEncoder:
    def encode(self, sensors: dict):
        """
        sensors = {
          "pH": 5.9,
          "EC": 1.3,
          "temp": 25.0,
          "humidity": 72.0
        }
        """
        vec = np.array(list(sensors.values()), dtype=np.float32)

        # Normalize roughly into 0–1 range (hackathon-safe)
        min_vals = np.array([4.0, 0.5, 10.0, 30.0])
        max_vals = np.array([7.0, 3.0, 40.0, 100.0])

        norm_vec = (vec - min_vals) / (max_vals - min_vals)
        return np.clip(norm_vec, 0.0, 1.0)
