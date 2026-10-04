import os
import json
from langchain_ollama import ChatOllama
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv

from agent.sub_agents.water_and_atmospheric_dependencies.json_extract import extract_json_object

load_dotenv()

# Configuration
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma4:e2b")


def predict_outcome(current_state: dict, proposed_action: dict) -> dict:
    """
    Stateless 'What-If' Engine using a local Ollama model (LLM-based Physics).
    Takes a snapshot and an action, returns the PREDICTED future state.
    """
    # Initialize Ollama Client
    llm = ChatOllama(
        model=OLLAMA_MODEL,
        base_url=OLLAMA_HOST,
        temperature=0.1,  # Low temp for consistent physics logic
        num_predict=1024,
        reasoning=False,
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
        # Invoke Azure OpenAI
        response = llm.invoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
        )

        # Clean and Parse JSON
        content = response.content.replace("```json", "").replace("```", "").strip()
        json_candidate = extract_json_object(content) or content
        result = json.loads(json_candidate)

        # Default fallback keys if the LLM misses them
        return {
            "predicted_health": result.get("predicted_health", 50.0),
            "risk_warning": result.get("risk_warning", "Unknown Risk"),
        }

    except Exception:
        return {
            "predicted_health": 70.0,
            "risk_warning": "Simulation Connection Failed",
        }
