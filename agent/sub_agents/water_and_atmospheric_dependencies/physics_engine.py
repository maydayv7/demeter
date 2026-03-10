import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

# Configuration
API_KEY = os.environ.get("GROQ_API_KEY")
MODEL_ID = "qwen/qwen3-32b" # Using the latest supported Groq model

def predict_outcome(current_state: dict, proposed_action: dict) -> dict:
    """
    Stateless 'What-If' Engine using Groq (LLM-based Physics).
    Takes a snapshot and an action, returns the PREDICTED future state.
    """
    if not API_KEY:
        print("   ⚠️ Physics Engine Error: Missing GROQ_API_KEY")
        return {"predicted_health": 50.0, "risk_warning": "No API Key configured"}

    # Initialize Groq Client
    llm = ChatOpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=API_KEY,
        model=MODEL_ID,
        temperature=0.1,
        max_tokens=1024,
        model_kwargs={"reasoning_effort": "none"}
    )
    
    system_prompt = (
        "You are a Hydroponic Physics Engine.\n"
        "Your task is to simulate the biological and chemical reaction of a plant ecosystem "
        "to a specific set of environmental changes over a 4-hour period.\n"
        "BE REALISTIC. If parameters are extreme (e.g. pH < 4, Temp > 35C), predict drastic health drops."
    )

    user_prompt = (
        f"Current Sensor Readings: {json.dumps(current_state)}\n"
        f"Proposed Action/Targets: {json.dumps(proposed_action)}\n\n"
        f"TASK:\n"
        f"1. Predict the Plant Health (0-100) after 4 hours.\n"
        f"2. Identify any specific risks (Root Rot, Tip Burn, Lockout, Shock).\n"
        f"OUTPUT JSON ONLY: {{ 'predicted_health': float, 'risk_warning': string }}"
    )

    try:
        # Invoke Groq
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ])
        
        # Clean and Parse JSON
        content = response.content.replace("```json", "").replace("```", "").strip()
        if not content:
            raise ValueError("Empty response from model")

        result = json.loads(content)
        
        # Default fallback keys if the LLM misses them
        return {
            "predicted_health": result.get("predicted_health", 50.0),
            "risk_warning": result.get("risk_warning", "Unknown Risk")
        }

    except Exception as e:
        print(f"   ⚠️ Physics Engine Error: {e}")
        return {"predicted_health": 70.0, "risk_warning": "Simulation Connection Failed"}