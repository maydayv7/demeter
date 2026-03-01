import json
import os
from dotenv import load_dotenv
from openai import OpenAI

# Load .env file relative to this script
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, '../../.env')
load_dotenv(env_path)

class SupervisorAgent:
    def __init__(self, researcher_agent):
        self.researcher = researcher_agent
        
        # ⚡ CONNECT TO GROQ CLOUD
        # CHECK: Ensure your .env file has 'GROK_API_KEY' or 'GROQ_API_KEY'
        # We use 'GROQ_API_KEY' here based on your previous messages
        api_key = os.getenv("GROQ_API_KEY") 

        if not api_key:
            print("⚠️ WARNING: API Key not found. Supervisor may fail.")

        self.llm = OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=api_key
        )

    def reason(self, current_fmu, similar_fmus, sub_agent_outputs):
        """
        The Core Reasoning Loop:
        1. Contextualize -> 2. Research -> 3. Synthesize -> 4. Decide
        """
        
        # --- STEP 1: Formulate the Research Question ---
        crop = current_fmu['metadata'].get('crop', 'Unknown Crop')
        stage = current_fmu['metadata'].get('stage', 'Unknown Stage')
        
        # E.g., "Lettuce Vegetative Low pH issues"
        research_query = f"{crop} {stage} {sub_agent_outputs.get('nutrient_analysis', '')} issues"
        
        print(f"🤔 Supervisor is asking Researcher: '{research_query}'")

        # --- STEP 2: The Researcher Fetches Evidence (RAG) ---
        # This now returns a clean STRING, not a list
        scientific_context = self.researcher.search(research_query)

        # --- STEP 3: Synthesize History (Memory) ---
        history_context = "\n".join([
            f"- Previous Case (Score {f['score']:.2f}): {f['payload'].get('outcome', 'No outcome recorded')}"
            for f in similar_fmus
        ])

        # --- STEP 4: The Final Prompt ---
        system_prompt = """
        You are the Chief Supervisor AI of a Hydroponic Facility.
        Your goal: Synthesize conflicting data to recommend the OPTIMAL action.
        
        PRINCIPLES:
        1. Plant Health is Priority #1.
        2. Verify Sub-Agent claims against the SCIENTIFIC KNOWLEDGE provided.
        3. If History contradicts Science, prefer Science (Manuals), but note the anomaly.
        """

        user_message = f"""
        ### SITUATION REPORT
        Target: {crop} ({stage})
        Sensors: {current_fmu['payload']['sensors']}

        ### SUB-AGENT ALERTS
        {json.dumps(sub_agent_outputs, indent=2)}

        ### SCIENTIFIC KNOWLEDGE (Verified Manuals)
        {scientific_context}

        ### HISTORICAL MEMORY (Similar Past Events)
        {history_context}

        ### COMMAND
        Analyze the situation. Resolve conflicts between agents using the Manuals. 
        Output JSON: {{ "reasoning": "...", "action": "...", "confidence": 0.0-1.0 }}
        """

        # --- STEP 5: Execute Reasoning on Groq ---
        try:
            response = self.llm.chat.completions.create(
                # We use Llama-3.1-8b because it is fast and smart enough for this logic
                model="llama-3.1-8b-instant", 
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.1, # Low temp for strict logic
                response_format={"type": "json_object"} # Force valid JSON
            )
            return json.loads(response.choices[0].message.content)
        
        except Exception as e:
            return {"error": str(e), "reasoning": "Groq Connection Failed"}