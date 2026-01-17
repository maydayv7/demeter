# tools/processing_tools.py
import os
import json
# Assuming Sentinel is available in the python path as per original code
from Sentinel.agent import FMUBuilder
from Sentinel.Encoders.Vision import VisionEncoder

class ProcessingTools:
    def __init__(self):
        self.builder = FMUBuilder()
        self.vision = VisionEncoder()

    def create_fmu(self, image_path: str, sensors: dict, metadata: dict):
        """
        Converts raw inputs into a standardized FMU object.
        Derived from the '/ingest' endpoint in main.py
        """
        # Ensure path is absolute as required by original logic
        abs_path = os.path.abspath(image_path)
        fmu = self.builder.create_fmu(abs_path, sensors, metadata)
        return fmu

    def encode_image(self, image_path: str):
        """
        Converts an image into a vector embedding.
        Derived from the '/search' endpoint in main.py
        """
        abs_path = os.path.abspath(image_path)
        # Returns a numpy array or list based on VisionEncoder implementation
        vector = self.vision.encode(abs_path)
        
        # Ensure it's a list for Qdrant
        if hasattr(vector, 'tolist'):
            return vector.tolist()
        return vector