from ultralytics import YOLO
import cv2
import json
import os
import logging
import numpy as np
import base64
from io import BytesIO
from PIL import Image

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VisionAgent:
    def __init__(self, model_path=None):
        logger.info("👁️ Initializing Vision Agent (Doctor)...")
        
        # 1. Find the project root
        if model_path:
            default_model = model_path
        else:
            current_file = os.path.abspath(__file__)
            agent_dir = os.path.dirname(os.path.dirname(current_file)) # agent/
            default_model = os.path.join(agent_dir, "model", "plant_disease_model.pt")
        
        self.model_name = default_model
        
        # 2. Load Model with Fallback
        try:
            if os.path.exists(self.model_name):
                logger.info(f"✅ Found plant disease model at: {self.model_name}")
                self.model = YOLO(self.model_name)
            else:
                logger.warning(f"⚠️ Custom model not found. Using generic YOLOv8n.")
                self.model = YOLO("yolov8n.pt")
                self.model_name = "yolov8n.pt"
            
            # Optimization
            self.model.to('cpu')
            
        except Exception as e:
            logger.error(f"❌ Critical Error loading model: {e}")
            self.model = None

    def analyze_frame(self, image_b64):
        """
        Scans a base64 encoded image for pests, diseases, or growth stages.
        """
        if not self.model:
            return {"error": "Model not initialized"}
            
        if not image_b64:
            return {"error": "No image data provided"}

        try:
            # 3. Decode Base64 to Image
            # Handle data URI scheme if present (e.g., "data:image/png;base64,...")
            if "," in image_b64:
                image_b64 = image_b64.split(",")[1]
            
            image_data = base64.b64decode(image_b64)
            image = Image.open(BytesIO(image_data))

            # 4. Run Inference
            # YOLO can accept PIL Images directly
            results = self.model.predict(image, conf=0.25, save=False, verbose=False)
            result = results[0]
            
            detections = []
            summary_counts = {}
            
            for box in result.boxes:
                class_id = int(box.cls[0])
                label = self.model.names[class_id]
                confidence = float(box.conf[0])
                
                detections.append({
                    "object": label,
                    "confidence": round(confidence, 2),
                    "box": [round(x, 2) for x in box.xywhn[0].tolist()] 
                })
                summary_counts[label] = summary_counts.get(label, 0) + 1

            # 5. Health Logic
            health_status = "HEALTHY"
            visual_alert = False
            
            if not detections:
                # If generic model, it might just see nothing. 
                # If disease model, empty usually means healthy.
                if "yolov8n" in self.model_name:
                    health_status = "NO_OBJECTS_DETECTED"
                else:
                    health_status = "HEALTHY"
            else:
                for label in summary_counts:
                    label_lower = label.lower()
                    # Keywords that imply sickness
                    sick_keywords = ['spot', 'rot', 'blight', 'mildew', 'rust', 'virus', 'miner', 'mite', 'wilt']
                    if any(x in label_lower for x in sick_keywords) and "healthy" not in label_lower:
                        health_status = "DISEASE_DETECTED"
                        visual_alert = True
                        break

            return {
                "status": "Success",
                "model_used": self.model_name,
                "health_assessment": health_status,
                "visual_alert": visual_alert,
                "object_counts": summary_counts,
                "detailed_detections": detections
            }
            
        except Exception as e:
           
            logger.error(f"Error during analysis: {e}")
            return {"error": str(e)}