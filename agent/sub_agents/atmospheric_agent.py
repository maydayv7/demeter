import os
from langchain_ollama import ChatOllama
from langgraph.graph import StateGraph, END

# Graph State & Nodes
from agent.sub_agents.water_and_atmospheric_dependencies.state import AgentState
from agent.sub_agents.water_and_atmospheric_dependencies.nodes import decide_node, simulate_node, finalize_node, execute_tools_node

# Tools
from agent.sub_agents.water_and_atmospheric_dependencies.retrieval import ask_historian, ask_rag, diagnose_plant, ask_memory
from agent.sub_agents.water_and_atmospheric_dependencies.tools import calculate_vpd, web_search

# Configuration
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma4:e2b")

ATMOS_PROMPT = """
You are the Atmospheric Specialist for a Hydroponic Farm.
Your goal is to optimize VAPOR PRESSURE DEFICIT (VPD) and PHOTOSYNTHESIS.

--- RULES ---
1. Target VPD: 0.8 - 1.2 kPa (Vegetative), 1.2 - 1.6 kPa (Flowering).
2. Humidity > 80% is dangerous (Mold Risk).
3. CO2 > 1500ppm is wasteful unless light is maxed out.

--- CURRENT CONTEXT ---
Sensors: {sensors}
Strategy: {strategy}
Research: {research}
History: {history}
Critique from Simulation: {critique}

TASK: Output ONLY a valid JSON object with keys: 'air_temp', 'humidity', 'co2', 'light_intensity'.
Each value is the ABSOLUTE TARGET you want that reading to reach this cycle
(e.g. 'air_temp': 24.0 means "set air temp to 24.0C") — NOT a delta.
Do not include markdown formatting, code blocks, or any explanatory text outside the JSON. Return strictly the raw JSON.
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
            "tool_round_count": 0,
            "tool_cache": {},
            "messages": []
        }

        result = self.app.invoke(initial_state)

   #     print(f"\n[{self.name}] Final Result: {result}")
        return result.get("final_action", {})