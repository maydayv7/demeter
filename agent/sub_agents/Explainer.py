import json
import os
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

class ExplainerAgent:
    def __init__(self):
        self.llm = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
        )
        self.deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1")

    def explain(self, current_fmu, similar_fmus, sub_agent_reports, final_decision):
        """
        Generates a detailed, human-readable log of the decision process.
        """
        
        # Construct the context for the LLM
        context = f"""
        CONTEXT DATA:
        - Current Sensors: {json.dumps(current_fmu['payload']['sensors'])}
        - Visual Context: {current_fmu['metadata'].get('stage')} {current_fmu['metadata'].get('crop')}
        - Expert Reports: {json.dumps(sub_agent_reports)}
        - Historical Precedents: Found {len(similar_fmus)} similar past cases.
        
        FINAL DECISION TAKEN:
        {json.dumps(final_decision)}
        """

        system_prompt = """
        You are the "Explainer" for an AI Hydroponic System. 
        Your goal is to write a "Chain of Thought" log that explains WHY a specific decision was made.
        
        STRUCTURE YOUR RESPONSE AS A CLEAN LIST OF STEPS:
        1. **Observation**: What did the sensors and vision see? (Cite specific numbers).
        2. **Precedent**: Did we see this before? (Reference the similar cases).
        3. **Logic**: Connect the dots. (e.g., "High pH + Yellow Leaves usually means X").
        4. **Conclusion**: Why is the recommended action the safest bet?
        
        Keep the tone professional, transparent, and educational.
        """

        try:
            response = self.llm.chat.completions.create(
                model=self.deployment_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": context}
                ],
                temperature=0.3 # Keep it factual
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Explanation unavailable: {str(e)}"