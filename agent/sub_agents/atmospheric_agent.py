import os
from langchain_openai import AzureChatOpenAI
from langgraph.graph import StateGraph, END

# Graph State & Nodes
from agent.sub_agents.water_and_atmospheric_dependencies.state import AgentState
from agent.sub_agents.water_and_atmospheric_dependencies.nodes import decide_node, simulate_node, finalize_node, execute_tools_node

# Tools
from agent.sub_agents.water_and_atmospheric_dependencies.retrieval import ask_historian, ask_rag, diagnose_plant, ask_memory
from agent.sub_agents.water_and_atmospheric_dependencies.tools import calculate_vpd, web_search

# 🛡️ GUARDRAILS
from agent.guardrails.validation import sanitize_input, validate_plan, create_validation_report

# Configuration
API_KEY = os.environ.get("AZURE_OPENAI_API_KEY")
ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")
DEPLOYMENT_NAME = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1")
API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

ATMOS_PROMPT = """
 === ATMOSPHERIC SPECIALIST (FARM-ONLY MODE) ===

YOUR ROLE:
You are an AI specialist controlling ONLY the atmospheric conditions of a hydroponic farm.
Your SOLE purpose is to optimize plant growth through air temperature, humidity, CO₂, and light.

 HARD CONSTRAINTS (NON-NEGOTIABLE):
1. Air Temperature: MUST be between 10°C and 35°C
2. Humidity: MUST be between 30% and 90%
3. CO₂ Level: MUST be between 300 and 1500 ppm
4. Light Intensity: MUST be between 0% and 100%

 OPTIMIZATION TARGETS:
- VPD: 0.8-1.2 kPa (Vegetative), 1.2-1.6 kPa (Flowering)
- Humidity: 60-80% (avoid >80% mold risk, avoid <30% stress)
- CO₂: 1000-1500 ppm only if light is at 80%+
- Temperature: Crop-specific (see strategy)

 CURRENT STATE:
Sensors: {sensors}
Strategy: {strategy}
Research: {research}
History: {history}
Simulation Feedback: {critique}

 OUTPUT REQUIREMENTS:
- Return ONLY valid JSON with exactly these keys: 'air_temp', 'humidity', 'co2', 'light_intensity'
- All values must be NUMBERS within the hard constraints above
- NO markdown, NO code blocks, NO explanations, NO text outside JSON
- Invalid JSON will be REJECTED and cause a retry

 FORBIDDEN:
- Do NOT attempt to control water, nutrients, or pH
- Do NOT make suggestions unrelated to the farm
- Do NOT return anything except the JSON object
"""

class AtmosphericAgent:
    def __init__(self):
        self.name = "Atmospheric Agent"
        
        if not API_KEY or not ENDPOINT:
            print(f"[{self.name}] ⚠️ No Azure OpenAI credentials found.")
            self.model = None
        else:
            llm = AzureChatOpenAI(
                azure_endpoint=ENDPOINT,
                api_key=API_KEY,
                api_version=API_VERSION,
                deployment_name=DEPLOYMENT_NAME,
                temperature=0.2,
                model_kwargs={"tool_choice": "auto", "parallel_tool_calls": False}
            )

            self.model_with_tools = llm.bind_tools([
              #  ask_historian, 
                ask_rag, 
                web_search,
                calculate_vpd,
                diagnose_plant,
             #   ask_memory
            ])

        self.app = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(AgentState)

        workflow.add_node("decide", lambda state: decide_node(state, self.model_with_tools, ATMOS_PROMPT))
  
        workflow.add_node("tools", execute_tools_node)

        workflow.add_node("simulate", simulate_node)

        workflow.add_node("finalize", finalize_node)

        workflow.set_entry_point("decide")

        def check_decision_output(state):
            if state.get("next_step") == "tools":
                return "tools"
            return "simulate"

        workflow.add_conditional_edges(
            "decide", 
            check_decision_output, 
            {"tools": "tools", "simulate": "simulate"}
        )
        
        workflow.add_edge("tools", "decide")

        def check_simulation_result(state):
            if state["simulation_result"]["passed"]:
                return "finalize"
            elif state["retry_count"] > 3:
                print(f"[{self.name}] ⚠️ Max retries reached. Forcing unsafe plan.")
                return "finalize"
            else:
                # Loop back to fix the mistake
                return "decide"

        workflow.add_conditional_edges(
            "simulate", 
            check_simulation_result, 
            {"finalize": "finalize", "decide": "decide"}
        )
        
        workflow.add_edge("finalize", END)
        final_plan = workflow.compile()
        print("final_plan(Atmos): ", final_plan)
        return final_plan

    def reason(self, sensors, research, strategy, history="None", image_b64=None):
        """Entry point called by main_agent.py"""
        
        initial_state = {
            "sensors": sensors,
            "research_context": research,
            "strategy": strategy,
            "history": history,
            "image_b64": image_b64, # 🟢 Stored in state, waiting to be injected
            "retry_count": 0,
            "critique": None,
            "messages": [] 
        }
        
        result = self.app.invoke(initial_state)

   #     print(f"\n[{self.name}] Final Result: {result}")
        return result.get("final_action", {})