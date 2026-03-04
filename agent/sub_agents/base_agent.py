import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# --- GROQ CONFIGURATION ---
# Common Groq Models: "llama3-70b-8192", "mixtral-8x7b-32768"
MODEL_ID = "llama-3.3-70b-versatile"
API_KEY = os.environ.get("GROQ_API_KEY")

class BaseReasoningAgent:
    def __init__(self, name):
        self.name = name

        if not API_KEY:
            print(f"[{self.name}] ⚠️ WARNING: GROQ_API_KEY not found in environment.")
            self.client = None
        else:
            try:
                self.client = OpenAI(
                    base_url="https://api.groq.com/openai/v1",
                    api_key=os.getenv("GROQ_API_KEY")
                )
            except Exception as e:
                print(f"[{self.name}] ⚠️ Groq Connection Error: {e}")
                self.client = None

    def _call_llm(self, prompt):
        """
        Helper method to send prompts to Groq Cloud.
        """
        if not self.client:
            return "Error: LLM Client not connected (Check API Key)."
            
        try:
            # Groq/OpenAI Chat Completion Structure
            response = self.client.chat.completions.create(
                model=MODEL_ID,
                messages=[
                    {"role": "system", "content": f"You are the {self.name} Agent for a high-tech hydroponic farm."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.6, 
                max_tokens=1024
            )
            return response.choices[0].message.content
            
        except Exception as e:
            return f"Reasoning Error: {e}"