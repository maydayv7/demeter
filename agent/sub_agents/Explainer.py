import json
from langchain_core.messages import SystemMessage, HumanMessage


class ExplainerAgent:
    def __init__(self, llm_client):
        self.llm = llm_client

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
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=context),
            ]
            response = self.llm.invoke(messages)
            return response.content
        except Exception as e:
            return f"Explanation unavailable: {str(e)}"
