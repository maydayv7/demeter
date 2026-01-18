import os
from openai import OpenAI

MODEL_ID = "llama3-70b-8192"
API_KEY = os.environ.get("GROQ_API_KEY")

class WaterAgent:
    def __init__(self):
        self.name = "Water Agent"
        if not API_KEY:
            self.client = None
        else:
            self.client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=os.getenv("GROQ_API_KEY"))

    def reason(self, current_state: dict, research_context: str) -> dict:
        """
        Decides on pH, EC, Water Temp changes.
        """
        print(f"[{self.name}] 💧 Analyzing Water solution...")
        
        prompt = (
            f"You are the Water Chemistry System.\n"
            f"RESEARCH GUIDELINES:\n{research_context}\n\n"
            f"CURRENT STATE:\n{current_state}\n\n"
            f"TASK: Output a JSON dictionary ONLY of target values for 'ph', 'ec' (dS/m), and 'water_temp' (C).\n"
            f"Example format: {{'ph': 5.8, 'ec': 1.5, 'water_temp': 20}}\n"
            f"Do not add markdown formatting."
        )

        if not self.client:
            return {"ph": 6.0, "ec": 1.2}

        try:
            response = self.client.chat.completions.create(
                model=MODEL_ID,
                messages=[{"role": "user", "content": prompt}]
            )
            content = response.choices[0].message.content.replace("```json", "").replace("```", "").strip()
            import ast
            return ast.literal_eval(content)
        except Exception as e:
            print(f"[{self.name}] Error: {e}")
            return {}