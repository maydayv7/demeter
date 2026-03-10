import os
import requests
import logging
import base64
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VisionAgent:
    def __init__(self):
        load_dotenv()
        self.endpoint = os.getenv("AZURE_ENDPOINT", "").rstrip('/')
        self.prediction_key = os.getenv("AZURE_PREDICTION_KEY")
        self.project_id = os.getenv("AZURE_PROJECT_ID")
        self.iteration_name = os.getenv("AZURE_ITERATION_NAME")
        self.model_name = "azure_custom_vision"
        
        if not all([self.endpoint, self.prediction_key, self.project_id, self.iteration_name]):
            logger.error("Missing Azure Custom Vision environment variables.")

    def analyze_frame(self, image_input, threshold=0.25):
        if not image_input:
            return {"error": "No image input provided"}

        image_data_bytes = None

        if isinstance(image_input, str) and len(image_input) < 1000 and os.path.exists(image_input):
            try:
                with open(image_input, "rb") as f:
                    image_data_bytes = f.read()
            except Exception as e:
                return {"error": str(e)}
        else:
            try:
                if ',' in image_input:
                    image_input = image_input.split(',')[1]
                image_data_bytes = base64.b64decode(image_input)
            except Exception as e:
                return {
                    "status": "Error",
                    "model_used": self.model_name,
                    "health_assessment": "UNKNOWN", 
                    "visual_alert": False,
                    "object_counts": {},
                    "detailed_detections": [],
                    "error": str(e)
                }

        try:
            url = f"{self.endpoint}/customvision/v3.0/Prediction/{self.project_id}/detect/iterations/{self.iteration_name}/image"
            
            headers = {
                "Prediction-Key": self.prediction_key,
                "Content-Type": "application/octet-stream"
            }
            
            response = requests.post(url, headers=headers, data=image_data_bytes)
            response.raise_for_status()
            
            predictions = response.json().get("predictions", [])
            
            detections = []
            summary_counts = {}
            
            for p in predictions:
                confidence = p["probability"]
                if confidence >= threshold:
                    label = p["tagName"]
                    box = p["boundingBox"]
                    
                    detections.append({
                        "object": label,
                        "confidence": round(confidence, 2),
                        "box": [
                            round(box["left"], 2),
                            round(box["top"], 2),
                            round(box["width"], 2),
                            round(box["height"], 2)
                        ]
                    })
                    summary_counts[label] = summary_counts.get(label, 0) + 1

            health_status = "HEALTHY"
            visual_alert = False
            
            if detections:
                for label in summary_counts:
                    label_lower = label.lower()
                    sick_keywords = ['spot', 'rot', 'blight', 'mildew', 'rust', 'virus', 'miner', 'mite', 'wilt', 'aphid']
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
            logger.error(f"Error during Azure analysis: {e}")
            return {
                "status": "Error",
                "model_used": self.model_name,
                "health_assessment": "UNKNOWN", 
                "visual_alert": False,
                "object_counts": {},
                "detailed_detections": [],
                "error": str(e)
            }