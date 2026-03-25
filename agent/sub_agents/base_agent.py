import os
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

# --- AZURE OPENAI CONFIGURATION ---
DEPLOYMENT_NAME = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1")
API_KEY = os.environ.get("AZURE_OPENAI_API_KEY")
ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")
API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

class BaseReasoningAgent:
    def __init__(self, name):
        self.name = name

        if not API_KEY or not ENDPOINT:
            print(f"[{self.name}] ⚠️ WARNING: Azure OpenAI credentials not found in environment.")
            self.client = None
        else:
            try:
                self.client = AzureOpenAI(
                    api_key=API_KEY,
                    api_version=API_VERSION,
                    azure_endpoint=ENDPOINT
                )
            except Exception as e:
                print(f"[{self.name}] ⚠️ Azure OpenAI Connection Error: {e}")
                self.client = None

    def _call_llm(self, prompt):
        """
        Helper method to send prompts to Azure OpenAI.
        """
        if not self.client:
            return "Error: LLM Client not connected (Check API Key)."
        
        print("Other Prompt:\n", prompt)
        try:
            # Azure OpenAI Chat Completion Structure
            response = self.client.chat.completions.create(
                model=DEPLOYMENT_NAME,
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