import numpy as np

class SensorEncoder:  # <--- Renamed to match agent.py
    def encode(self, sensor_data: dict) -> np.ndarray:
        """
        Encodes dictionary of sensor values/windows into a flat vector.
        """
        features = []
        # Sort keys to ensure vector consistency
        for key in sorted(sensor_data.keys()):
            val = sensor_data[key]
            
            if isinstance(val, list) and val:
                # Handle window of data (Mean, Std, Last)
                arr = np.array(val)
                features.extend([float(np.mean(arr)), float(np.std(arr)), float(arr[-1])])
            elif isinstance(val, (int, float)):
                # Handle single value
                features.append(float(val))
            else:
                # Fallback
                features.append(0.0)
                
        return np.array(features, dtype=np.float32)