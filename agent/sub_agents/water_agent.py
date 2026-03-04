import os
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

# Graph State & Nodes
from agent.sub_agents.water_and_atmospheric_dependencies.state import AgentState
from agent.sub_agents.water_and_atmospheric_dependencies.nodes import decide_node, simulate_node, finalize_node, execute_tools_node

# Tools
from agent.sub_agents.water_and_atmospheric_dependencies.retrieval import ask_historian, ask_rag
from agent.sub_agents.water_and_atmospheric_dependencies.tools import check_ph_safety, web_search

# Configuration
API_KEY = os.environ.get("GROQ_API_KEY")

WATER_PROMPT = """
You are the Water & Nutrient Specialist for a Hydroponic Farm.
Your goal is to maintain HOMEOSTASIS in the root zone.

--- RULES ---
1. pH is Logarithmic. Never swing more than 0.5 in one cycle.
2. If Strategy is 'Flush', EC must drop to < 0.2 dS/m.
3. If Water Temp > 24C, you MUST recommend cooling or beneficial bacteria to prevent root rot.

--- CURRENT CONTEXT ---
Sensors: {sensors}
Strategy: {strategy}
Research: {research}
History: {history}
Critique from Simulation: {critique}

TASK: Output a JSON dict with keys: 'ph', 'ec' (dS/m), 'water_temp' (C).
"""

class WaterAgent:
    def __init__(self):
        self.name = "Water Agent"
        
        # 1. Initialize Model
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
            
            # 2. 🟢 BIND TOOLS (The "Arms")
            # We bind the general research tools AND the specific math tool (pH Safety)
            self.model_with_tools = llm.bind_tools([
                ask_historian, 
                ask_rag, 
                web_search,
                check_ph_safety 
            ])
        
        # 3. Build the Graph (The "Brain")
        self.app = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(AgentState)

        # --- A. ADD NODES ---
        # 1. Decide: Uses the LLM with Tools bound to it
        workflow.add_node("decide", lambda state: decide_node(state, self.model_with_tools, WATER_PROMPT))
        
        # 2. Tools: Executes the function if the LLM calls one
        workflow.add_node("tools", execute_tools_node)
        
        # 3. Simulate: Checks physics/safety
        workflow.add_node("simulate", simulate_node)
        
        # 4. Finalize: Formatting
        workflow.add_node("finalize", finalize_node)

        # --- B. DEFINE FLOW ---
        workflow.set_entry_point("decide")

        # Logic 1: Decide -> (Tools OR Simulate)
        def check_decision_output(state):
            if state.get("next_step") == "tools":
                return "tools"
            return "simulate"

        workflow.add_conditional_edges(
            "decide", 
            check_decision_output, 
            {"tools": "tools", "simulate": "simulate"}
        )
        
        # Logic 2: Tools -> Back to Decide (ReAct Loop)
        workflow.add_edge("tools", "decide")

        # Logic 3: Simulate -> (Finalize OR Retry)
        def check_simulation_result(state):
            if state["simulation_result"]["passed"]:
                return "finalize"
            elif state["retry_count"] > 3:
                print(f"[{self.name}] ⚠️ Max retries reached. Forcing unsafe plan.")
                return "finalize"
            else:
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
            "messages": [] 
        }
        
        result = self.app.invoke(initial_state)
        return result.get("final_action", {})