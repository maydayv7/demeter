import os
from openai import OpenAI

# Configuration
MODEL_ID = "openai/gpt-oss-120b"
API_KEY = os.environ.get("GROQ_API_KEY")

class AtmosphericAgent:
    def __init__(self):
        self.name = "Atmospheric Agent"
        if not API_KEY:
            print(f"[{self.name}] ⚠️ GROQ_API_KEY missing.")
            self.client = None
        else:
            self.client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=os.getenv("GROQ_API_KEY"))

    def reason(self, current_state: dict, research_context: str) -> dict:
        """
        Decides on CO2, Light, Temp, Humidity changes.
        Returns a dict of actions (e.g., {"CO2": 1200, "Light": 800})
        """
        print(f"[{self.name}] 🌤️ Analyzing Air conditions...")
        
        prompt = (
            f"You are the Atmospheric Control System.\n"
            f"RESEARCH GUIDELINES:\n{research_context}\n\n"
            f"CURRENT STATE:\n{current_state}\n\n"
            f"TASK: Output a JSON dictionary ONLY of target values for 'co2' (ppm), 'light_intensity' (umol), "
            f"'air_temp' (C), and 'humidity' (%).\n"
            f"Example format: {{'co2': 1000, 'light_intensity': 600, 'air_temp': 24, 'humidity': 60}}\n"
            f"Do not add markdown formatting or explanation."
        )

        if not self.client:
            return {"co2": 400, "light_intensity": 500} # Defaults

        try:
            response = self.client.chat.completions.create(
                model=MODEL_ID,
                messages=[{"role": "user", "content": prompt}]
            )
            # Simple cleaning to ensure valid JSON
            content = response.choices[0].message.content.replace("```json", "").replace("```", "").strip()
            # In a real system, use json.loads(content) with error handling
            import ast
            return ast.literal_eval(content)
        except Exception as e:
            print(f"[{self.name}] Error: {e}")
            return {}