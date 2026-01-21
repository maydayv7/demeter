from ultralytics import YOLO
import cv2
import json
import os
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VisionAgent:
    def __init__(self, model_path=None):
        logger.info("👁️ Initializing Vision Agent (Doctor)...")
        
        # 1. Find the project root (directory containing "agent" folder)
        if model_path:
            default_model = model_path
        else:
            # Get the directory where THIS file (Doctor.py) is located
            current_file = os.path.abspath(__file__)
            # Navigate up to agent/sub_agents/Doctor.py -> agent/
            agent_dir = os.path.dirname(os.path.dirname(current_file))
            # Now go to agent/model/plant_disease_model.pt
            default_model = os.path.join(agent_dir, "model", "plant_disease_model.pt")
        
        self.model_name = default_model
        
        # 2. Load Model with Fallback
        try:
            # Check if file exists
            if os.path.exists(self.model_name):
                logger.info(f"✅ Found plant disease model at: {self.model_name}")
                self.model = YOLO(self.model_name)
                logger.info(f"✅ Loaded Custom Plant Doctor")
            else:
                # Debug info
                logger.warning(f"⚠️ Model not found at: {self.model_name}")
                logger.warning(f"   Looking in: {os.path.dirname(self.model_name)}")
                logger.info("📥 Using generic YOLOv8n instead...")
                self.model = YOLO("yolov8n.pt")
                self.model_name = "yolov8n.pt"
            
            # CPU Optimization for Laptop
            self.model.to('cpu')
            logger.info("✅ Vision Agent ready")
            
        except Exception as e:
            logger.error(f"❌ Critical Error loading model: {e}")
            self.model = None

    def analyze_frame(self, image_path):
        """
        Scans an image for pests, diseases, or growth stages.
        """
        if not self.model:
            return {"error": "Model not initialized"}
            
        if not os.path.exists(image_path):
            return {"error": f"Image file not found: {image_path}"}

        try:
            # 3. Run Inference
            results = self.model.predict(image_path, conf=0.25, save=False, verbose=False)
            result = results[0]
            
            detections = []
            summary_counts = {}
            
            # 4. Process Detections
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

            # 5. Smart Health Logic
            health_status = "HEALTHY"
            visual_alert = False
            
            if not detections:
                health_status = "NO_PLANTS_DETECTED"
            else:
                for label in summary_counts:
                    label_lower = label.lower()
                    if "healthy" not in label_lower and any(x in label_lower for x in ['spot', 'rot', 'blight', 'mildew', 'rust', 'virus', 'miner', 'mite']):
                        health_status = "DISEASE_DETECTED"
                        visual_alert = True
                        break

            report = {
                "status": "Success",
                "model_used": self.model_name,
                "health_assessment": health_status,
                "visual_alert": visual_alert,
                "object_counts": summary_counts,
                "detailed_detections": detections
            }
            
            return report

        except Exception as e:
            logger.error(f"Error during analysis: {e}")
            return {"error": str(e)}

# --- Quick Test Block ---
if __name__ == "__main__":
    agent = VisionAgent()
    
    test_path = "test_plant.jpg" 
    
    if not os.path.exists(test_path):
        import numpy as np
        print("⚠️ Creating dummy test image...")
        dummy_img = np.zeros((640, 640, 3), dtype=np.uint8)
        dummy_img[:] = (0, 255, 0)
        cv2.rectangle(dummy_img, (100, 100), (200, 200), (0, 0, 255), -1)
        cv2.imwrite(test_path, dummy_img)

    print("\n--- ANALYSIS REPORT ---")
    report = agent.analyze_frame(test_path)
    print(json.dumps(report, indent=2))