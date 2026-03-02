import numpy as np

class SensorEncoder:
    # 🔧 CONFIG: Define the maximum possible value for each sensor.
    # We divide raw values by this to get a 0-1 range.
    SCALERS = {
        "pH": 14.0,       # pH Scale is 0-14
        "EC": 5.0,        # EC rarely exceeds 3.0-4.0 in hydroponics
        "temp": 50.0,     # 50°C (122°F) is a safe max for plants
        "humidity": 100.0 # 0-100%
    }

    def encode(self, sensor_data: dict) -> np.ndarray:
        """
        Encodes sensor data into a NORMALIZED vector for balanced search.
        
        Example: 
          Input:  {'humidity': 72.0}
          Vector: [0.72] (Balanced for math)
          Payload: {'humidity': 72.0} (Readable for humans)
        """
        features = []
        
        # Sort keys to ensure vector consistency (EC, humidity, pH, temp)
        for key in sorted(sensor_data.keys()):
            raw_val = sensor_data[key]
            
            # Determine the divisor (Default to 100.0 if unknown sensor)
            max_val = self.SCALERS.get(key, 100.0)

            if isinstance(raw_val, list) and raw_val:
                # Handle Window (Mean, Std, Last)
                arr = np.array(raw_val, dtype=float)
                
                # Normalize each statistic
                mean_norm = np.mean(arr) / max_val
                std_norm = np.std(arr) / max_val
                last_norm = arr[-1] / max_val
                
                features.extend([mean_norm, std_norm, last_norm])

            elif isinstance(raw_val, (int, float)):
                # Handle Single Value
                norm_val = float(raw_val) / max_val
                
                # Clamp to ensure we never break the 0-1 scale (e.g. if temp is 55)
                norm_val = max(0.0, min(1.0, norm_val))
                
                features.append(norm_val)
            else:
                features.append(0.0)
                
        return np.array(features, dtype=np.float32)