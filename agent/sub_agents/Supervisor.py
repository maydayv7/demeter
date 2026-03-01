import os
from openai import OpenAI

MODEL_ID = "llama3-70b-8192"
API_KEY = os.environ.get("GROQ_API_KEY")

class SupervisorAgent:
    def __init__(self):
        self.name = "Supervisor"
        if not API_KEY:
            self.client = None
        else:
            self.client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=API_KEY)

    def synthesize_plan(self, atmos_plan: dict, water_plan: dict, current_meta: dict, history: list) -> dict:
        """
        Takes plans from sub-agents and creates the final JSON payload for the Simulator.
        """
        print(f"[{self.name}] 👮 Validating and merging plans...")

        # 1. Merge the plans
        # We start with the sub-agent recommendations
        combined_action = {**atmos_plan, **water_plan}

        # 2. Reasoning (Optional: Check for conflicts)
        prompt = (
            f"You are the Farm Supervisor.\n"
            f"Proposed Atmospheric Actions: {atmos_plan}\n"
            f"Proposed Water Actions: {water_plan}\n"
            f"Current Crop: {current_meta.get('crop')} ({current_meta.get('stage')})\n"
            f"Similar History: {history}\n\n"
            f"TASK: Review these actions. If they are safe, merge them into a single JSON object.\n"
            f"If there is a conflict (e.g., high Temp but low CO2), adjust them.\n"
            f"OUTPUT: A clean JSON object strictly matching the simulator's expected action keys.\n"
            f"Do not add markdown."
        )

        try:
            # For speed, we might just return the combined dict, 
            # but here we ask the LLM to validate/format it.
            response = self.client.chat.completions.create(
                model=MODEL_ID,
                messages=[{"role": "user", "content": prompt}]
            )
            content = response.choices[0].message.content.replace("```json", "").replace("```", "").strip()
            import ast
            final_json = ast.literal_eval(content)
            return final_json
        except Exception:
            # Fallback: Just return the merged dicts
            return combined_action