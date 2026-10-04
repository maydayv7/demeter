import os
from ollama import Client
from dotenv import load_dotenv

load_dotenv()

# --- OLLAMA CONFIGURATION ---
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma4:e2b")

class BaseReasoningAgent:
    def __init__(self, name):
        self.name = name

        try:
            self.client = Client(host=OLLAMA_HOST)
        except Exception:
            self.client = None

    def _call_llm(self, prompt):
        """
        Helper method to send prompts to the local Ollama model.
        """
        if not self.client:
            return "Error: LLM Client not connected (Check OLLAMA_HOST)."

        print("Other Prompt:\n", prompt)
        try:
            response = self.client.chat(
                model=OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": f"You are the {self.name} Agent for a high-tech hydroponic farm."},
                    {"role": "user", "content": prompt}
                ],
                options={"temperature": 0.6, "num_predict": 1024}
            )
            return response["message"]["content"]

        except Exception as e:
            return f"Reasoning Error: {e}"
