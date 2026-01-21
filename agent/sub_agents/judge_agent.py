import os
import json
from qdrant_client import models
from Sentinel.fmu import FMU
from agent.sub_agents.base_agent import BaseReasoningAgent
from Qdrant.Client import client
from Qdrant.Store import store_fmu

COLLECTION_NAME = "Farm_Memory"

class JudgeAgent(BaseReasoningAgent):
    def __init__(self):
        super().__init__(name="Judge Agent")
        self.qdrant = client
        # Using Llama 3.2 Vision (11B) for analysis
        self.vision_model = "meta-llama/llama-4-scout-17b-16e-instruct"

    def review_previous_cycle(self, current_fmu: FMU):
        """
        Only looks back at Sequence N-1 to judge its outcome based on N.
        Does NOT store the current state (N).
        """
        print(f"[{self.name}] 👨‍⚖️ Reviewing previous cycle results...")

        crop_id = current_fmu.metadata.get("crop_id")
        current_seq = current_fmu.metadata.get("sequence_number", 1)
        image_b64 = current_fmu.metadata.get("image_b64") # Raw image for vision analysis

        if current_seq > 1:
            prev_seq = current_seq - 1
            print(f"[{self.name}] 🔍 Looking up history (Seq #{prev_seq})...")
            
            prev_point = self._find_specific_sequence(crop_id, prev_seq)
            
            if prev_point:
                # Judge: Did the plant improve?
                health_analysis = self._analyze_visual_health(
                    image_b64, 
                    current_fmu.metadata.get("sensors")
                )
                
                # Update N-1 with the verdict
                self._update_outcome(prev_point.id, health_analysis)
            else:
                print(f"[{self.name}] ⚠️ History record (Seq #{prev_seq}) not found.")
        else:
            print(f"[{self.name}] 🆕 First cycle. No history to review.")

    def _find_specific_sequence(self, crop_id, sequence_number):
        try:
            s_filter = models.Filter(
                must=[
                    models.FieldCondition(key="crop_id", match=models.MatchValue(value=crop_id)),
                    models.FieldCondition(key="sequence_number", match=models.MatchValue(value=sequence_number))
                ]
            )
            res, _ = self.qdrant.scroll(collection_name=COLLECTION_NAME, scroll_filter=s_filter, limit=1)
            return res[0] if res else None
        except Exception as e:
            print(f"[{self.name}] ⚠️ DB Error: {e}")
            return None

    def _analyze_visual_health(self, image_b64, sensors):
        if not image_b64:
            return {"outcome": "NO_IMAGE", "health_score": 0}

        prompt = (
            f"Sensors: {sensors}\n"
            f"Task: Assess and find out the current condition of the plant.\n"
            f"Output JSON: {{'health_score': 0-100, 'outcome': 'IMPROVED'|'DETERIORATED'|'STABLE', 'notes': '...' }}"
        )
        
        try:
            image_url = f"data:image/png;base64,{image_b64}"
            completion = self.client.chat.completions.create(
                model=self.vision_model,
                messages=[
                    {"role": "user", "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            return json.loads(completion.choices[0].message.content)
        except Exception as e:
            print(f"[{self.name}] ⚠️ Vision Error: {e}")
            return {"outcome": "ERROR", "health_score": 0}

    def _update_outcome(self, point_id, analysis):
        self.qdrant.set_payload(
            collection_name=COLLECTION_NAME,
            payload={
                "outcome": "condition_assessed" + analysis.get("outcome", "UNKNOWN") + "| health_score:" + str(analysis.get("health_score", 0)) + " | notes:" + analysis.get("notes", "")
            },
            points=[point_id]
        )
        print(f"[{self.name}] ✅ Outcome Updated for ID {point_id}: {analysis.get('outcome')}")