import uuid
import base64
import io
from datetime import datetime
import numpy as np
from pathlib import Path

# Ensure these imports match your project structure
from Sentinel.Encoders.Vision import VisionEncoder
from Sentinel.Encoders.TimeSeries import SensorEncoder
from Sentinel.fmu import FMU
from Qdrant.Store import store_fmu

class FMUBuilder:
    def __init__(self):
        self.vision = VisionEncoder()
        self.sensors = SensorEncoder()

    def create_fmu(self, image_input, sensor_data, metadata=None):
        """
        Creates an FMU from either:
        - A file path (str/Path)
        - A Base64 encoded image string
        
        Args:
            image_input: Either a file path string or base64 string
            sensor_data: Dictionary of sensor readings
            metadata: Optional metadata dictionary
        """
        
        # Detect if input is base64 or file path
        if self._is_base64(image_input):
            # Handle Base64 input
            img_vec = self._encode_from_base64(image_input)
        else:
            # Handle file path input (original behavior)
            img_vec = self.vision.encode(image_input)
        
        # Encode sensor data
        sensor_vec = self.sensors.encode(sensor_data)

        # Combine vectors
        fmu_vector = np.concatenate([img_vec, sensor_vec]).tolist()

        # --- UPDATE START ---
        # 1. Ensure metadata is a dictionary
        if metadata is None:
            metadata = {}

        final_payload = {
            "timestamp": datetime.utcnow().isoformat(),
            
            # ✅ STORE RAW SENSORS (For Humans/Frontend)
            "sensors": sensor_data, 
            
            # ✅ UNPACK METADATA (crop, stage, etc.)
            **metadata,
            
            # ✅ ENFORCE CRITICAL FIELDS (Defaults if missing)
            "crop_id": metadata.get("crop_id", "UNKNOWN_CROP"),
            "sequence_number": metadata.get("sequence_number", 1),
            "action_taken": metadata.get("action_taken", "PENDING_ACTION"),
            "outcome": metadata.get("outcome", "PENDING_OBSERVATION"),
            "explanation_log": metadata.get("explanation_log", "PENDING_ANALYSIS")
        }

        return FMU(
            id=str(uuid.uuid4()),
            vector=fmu_vector,
            metadata=final_payload # This becomes the Qdrant Payload
        )
    
    def _is_base64(self, s):
        """
        Detect if string is base64 or a file path.
        Returns True if it looks like base64, False if it looks like a path.
        """
        if not isinstance(s, str):
            return False
            
        # If it has path separators, it's probably a path
        if '/' in s or '\\' in s or Path(s).exists():
            return False
        
        # If it has base64 header, it's definitely base64
        if s.startswith('data:image'):
            return True
            
        # Check if it's valid base64 (after removing potential header)
        test_str = s.split(',')[-1] if ',' in s else s
        
        # Base64 strings are typically very long and only contain valid b64 chars
        if len(test_str) > 100:  # Arbitrary threshold
            try:
                base64.b64decode(test_str, validate=True)
                return True
            except Exception:
                return False
        
        return False
    
    def _encode_from_base64(self, image_base64):
        """
        Decode base64 string and encode the image.
        """
        # Remove header if present (e.g., "data:image/png;base64,...")
        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]
        
        # Add padding if necessary (fix the "multiple of 4" error)
        missing_padding = len(image_base64) % 4
        if missing_padding:
            image_base64 += '=' * (4 - missing_padding)
        
        # Decode to bytes
        image_bytes = base64.b64decode(image_base64)
        
        # Create file-like object
        image_stream = io.BytesIO(image_bytes)
        
        # Encode using VisionEncoder
        return self.vision.encode(image_stream)


# if __name__ == "__main__":
#     builder = FMUBuilder()

#     sensors = {
#         "pH": 5.9,
#         "EC": 1.3,
#         "temp": 25.0,
#         "humidity": 72.0
#     }

#     # Test with base64
#     sample_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="
    
#     fmu = builder.create_fmu(sample_base64, sensors, {
#         "crop": "lettuce",
#         "stage": "vegetative"
#     })

#     print("✅ FMU ID:", fmu.id)
#     print("✅ Vector length:", len(fmu.vector))
    
#     # Check for the new fields in the output
#     print("\n🔍 Checking Schema:")
#     print(f"   - Action: {fmu.metadata.get('action_taken')}")
#     print(f"   - Outcome: {fmu.metadata.get('outcome')}")
#     print(f"   - Sensors Saved: {'sensors' in fmu.metadata}")