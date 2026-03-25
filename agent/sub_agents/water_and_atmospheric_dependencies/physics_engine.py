import os
import json
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv

load_dotenv()

# Configuration
API_KEY = os.environ.get("AZURE_OPENAI_API_KEY")
ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")
DEPLOYMENT_NAME = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1")
API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")


def predict_outcome(current_state: dict, proposed_action: dict) -> dict:
    """
    Stateless 'What-If' Engine using Azure OpenAI (LLM-based Physics).
    Takes a snapshot and an action, returns the PREDICTED future state.
    """
    if not API_KEY or not ENDPOINT:
        print("   ⚠️ Physics Engine Error: Missing Azure OpenAI credentials")
        return {"predicted_health": 50.0, "risk_warning": "No API Key configured"}

    # Initialize Azure OpenAI Client
    llm = AzureChatOpenAI(
        azure_endpoint=ENDPOINT,
        api_key=API_KEY,
        api_version=API_VERSION,
        deployment_name=DEPLOYMENT_NAME,
        temperature=0.1,  # Low temp for consistent physics logic
        max_tokens=1024,
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
        result = json.loads(content)

        # Default fallback keys if the LLM misses them
        return {
            "predicted_health": result.get("predicted_health", 50.0),
            "risk_warning": result.get("risk_warning", "Unknown Risk"),
        }

    except Exception as e:
        print(f"   ⚠️ Physics Engine Error: {e}")
        return {
            "predicted_health": 70.0,
            "risk_warning": "Simulation Connection Failed",
        }
