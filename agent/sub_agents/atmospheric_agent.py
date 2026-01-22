import os
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

# Graph State & Nodes
from agent.sub_agents.water_and_atmospheric_dependencies.state import AgentState
from agent.sub_agents.water_and_atmospheric_dependencies.nodes import decide_node, simulate_node, finalize_node, execute_tools_node

# Tools
from agent.sub_agents.water_and_atmospheric_dependencies.retrieval import ask_historian, ask_rag, diagnose_plant, ask_memory
from agent.sub_agents.water_and_atmospheric_dependencies.tools import calculate_vpd, web_search

# Configuration
API_KEY = os.environ.get("GROQ_API_KEY")

MODEL_ID = "llama-3.3-70b-versatile"

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

TASK: Output a JSON dict with keys: 'air_temp' (C), 'humidity' (%), 'co2' (ppm), 'light_intensity' (umol).
"""

class AtmosphericAgent:
    def __init__(self):
        self.name = "Atmospheric Agent"
        
        if not API_KEY:
            print(f"[{self.name}] ⚠️ No API Key found.")
            self.model = None
        else:
            llm = ChatOpenAI(
                base_url="https://api.groq.com/openai/v1", 
                api_key=API_KEY,
                model="llama-3.3-70b-versatile",
                temperature=0.2
            )

            self.model_with_tools = llm.bind_tools([
                ask_historian, 
                ask_rag, 
                web_search,
                calculate_vpd,
                diagnose_plant,
                ask_memory
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
        return workflow.compile()

    def reason(self, sensors, research, strategy, history="None"):
        """Entry point called by main_agent.py"""
        initial_state = {
            "sensors": sensors,
            "research_context": research,
            "strategy": strategy,
            "history": history,
            "retry_count": 0,
            "critique": None,
            "messages": [] # Stores conversation history for ReAct
        }
        
        result = self.app.invoke(initial_state)
        return result.get("final_action", {})