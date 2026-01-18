import os
import ast
from openai import OpenAI
from Qdrant.Store import store_fmu # Import storage function

MODEL_ID = "openai/gpt-oss-120b"
API_KEY = os.environ.get("GROQ_API_KEY")

class SupervisorAgent:
    def __init__(self):
        self.name = "Supervisor"
        if not API_KEY:
            self.client = None
        else:
            self.client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=API_KEY)

    def synthesize_plan(self, atmos_plan: dict, water_plan: dict, fmu, history: list) -> dict:
        """
        1. Validates and merges plans.
        2. UPDATES the FMU with the final action.
        3. UPLOADS the FMU to Qdrant.
        """
        print(f"[{self.name}] 👮 Validating, Merging & Storing...")

        # 1. Merge & Reason
        combined_action = {**atmos_plan, **water_plan}
        current_meta = fmu.metadata

        prompt = (
            f"You are the Farm Supervisor.\n"
            f"Proposed Atmospheric Actions: {atmos_plan}\n"
            f"Proposed Water Actions: {water_plan}\n"
            f"Current Crop: {current_meta.get('crop')} ({current_meta.get('stage')})\n"
            f"History Context: {history}\n\n"
            f"TASK: Output a single valid JSON object for the simulator controls.\n"
            f"Strict JSON only."
        )

        final_action = combined_action # Default
        try:
            if self.client:
                response = self.client.chat.completions.create(
                    model=MODEL_ID,
                    messages=[{"role": "user", "content": prompt}]
                )
                content = response.choices[0].message.content.replace("```json", "").replace("```", "").strip()
                final_action = ast.literal_eval(content)
        except Exception as e:
            print(f"[{self.name}] ⚠️ Reasoning failed, using defaults: {e}")

        # 2. Update FMU Metadata
        print(f"[{self.name}] 📝 Recording Action: {final_action}")
        fmu.metadata["action_taken"] = str(final_action) # Store as string or dict depending on your DB preference
        
        # 3. Clean & Store FMU
        # Critical: Remove large image blob before uploading to Qdrant
        if "image_b64" in fmu.metadata:
            del fmu.metadata["image_b64"]
            
        store_fmu(fmu)
        print(f"[{self.name}] 💾 State (Seq #{fmu.metadata.get('sequence_number')}) saved to DB.")

        return final_action