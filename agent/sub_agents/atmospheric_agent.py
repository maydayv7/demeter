import os
from langchain_ollama import ChatOllama
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
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma4:e2b")

ATMOS_PROMPT = """
 === ATMOSPHERIC SPECIALIST (FARM-ONLY MODE) ===

YOUR ROLE:
You are an AI specialist controlling ONLY the atmospheric conditions of a hydroponic farm.
Your SOLE purpose is to optimize plant growth through air temperature, humidity, CO₂, and light.

 HARD CONSTRAINTS (NON-NEGOTIABLE - YOU WILL FAIL IF YOU VIOLATE THESE):
1. Air Temperature: MUST be between 10°C and 35°C (failure if outside range)
2. Humidity: MUST be between 30% and 90% (failure if outside range)
3. CO₂ Level: MUST be between 300 and 1500 ppm (failure if outside range)
4. Light Intensity: MUST be between 0% and 100% (failure if outside range)

 OPTIMIZATION TARGETS (aim for these if possible, but NEVER violate hard constraints):
- VPD: 0.8-1.2 kPa (Vegetative), 1.2-1.6 kPa (Flowering)
- Humidity: 60-80% (avoid >80% mold risk, avoid <30% stress)
- CO₂: 1000-1500 ppm only if light is at 80%+
- Temperature: Crop-specific (see strategy)

 CRITICAL SITUATION HANDLING:
- If plant is in critical condition (health < 50%), STAY SAFE within hard constraints
- Do NOT attempt aggressive corrections that violate bounds
- Conservative stable values within bounds are BETTER than aggressive out-of-bounds values
- The system will gradually improve through multiple safe cycles

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
- EVERY violation of hard constraints will cause a RETRY - your plan will be rejected

 FORBIDDEN:
- Do NOT attempt to control water, nutrients, or pH
- Do NOT make suggestions unrelated to the farm
- Do NOT return anything except the JSON object
- Do NOT violate hard constraints under ANY circumstance
"""

class AtmosphericAgent:
    def __init__(self):
        self.name = "Atmospheric Agent"

        try:
            llm = ChatOllama(
                model=OLLAMA_MODEL,
                base_url=OLLAMA_HOST,
                temperature=0.2,
                reasoning=False,
            )

            self.model_with_tools = llm.bind_tools([
              #  ask_historian,
                ask_rag,
                web_search,
                calculate_vpd,
                diagnose_plant,
             #   ask_memory
            ])
            # Same model, no tools bound — used once the tool-call budget is
            # exhausted so the model can no longer call anything and must answer.
            self.model_plain = llm
        except Exception:
            self.model_with_tools = None
            self.model_plain = None

        self.app = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(AgentState)

        workflow.add_node("decide", lambda state: decide_node(state, self.model_with_tools, self.model_plain, ATMOS_PROMPT))
  
        workflow.add_node("tools", execute_tools_node)

        workflow.add_node("simulate", simulate_node)

        workflow.add_node("finalize", finalize_node)
        
        workflow.add_node("skip_unsafe", lambda state: {"final_action": {"air_temp": 25, "humidity": 65, "co2": 800, "light_intensity": 50}})

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
                print(f"[{self.name}] ⚠️ Max retries reached. Skipping execution (no-op).")
                return "skip_unsafe"
            else:
                # Loop back to fix the mistake
                return "decide"

        workflow.add_conditional_edges(
            "simulate", 
            check_simulation_result, 
            {"finalize": "finalize", "decide": "decide", "skip_unsafe": "skip_unsafe"}
        )
        
        workflow.add_edge("finalize", END)
        workflow.add_edge("skip_unsafe", END)
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
            "tool_round_count": 0,
            "tool_cache": {},
            "messages": []
        }

        result = self.app.invoke(initial_state)

   #     print(f"\n[{self.name}] Final Result: {result}")
        return result.get("final_action", {})