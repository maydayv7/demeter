import os
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

# Graph State & Nodes
from agent.sub_agents.water_and_atmospheric_dependencies.state import AgentState
from agent.sub_agents.water_and_atmospheric_dependencies.nodes import decide_node, simulate_node, finalize_node, execute_tools_node

# Tools
from agent.sub_agents.water_and_atmospheric_dependencies.retrieval import ask_historian, ask_rag, diagnose_plant, ask_memory
from agent.sub_agents.water_and_atmospheric_dependencies.tools import check_ph_safety, web_search

# Configuration
API_KEY = os.environ.get("GROQ_API_KEY")

# 🟢 UPDATE 1: Mention visual data availability in the prompt
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
Visual Data: The latest camera image is available via the 'diagnose_plant' tool.

TASK: Output a JSON dict with keys: 'ph', 'ec' (dS/m), 'water_temp' (C).
If you suspect root rot or issues with nutrient uptake (e.g. yellowing leaves), call 'diagnose_plant()' (with no arguments) to verify.
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
                model="qwen/qwen3-32b", # Keeping consistent model
                temperature=0.2,
                model_kwargs={"tool_choice": "auto", "parallel_tool_calls": False}
            )
            
            # 2. BIND TOOLS
            self.model_with_tools = llm.bind_tools([
             #   ask_historian, 
                web_search,
                check_ph_safety,
                diagnose_plant, # 🟢 Tool is already here
             #   ask_memory
            ])
        
        # 3. Build the Graph
        self.app = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(AgentState)

        # Nodes
        workflow.add_node("decide", lambda state: decide_node(state, self.model_with_tools, WATER_PROMPT))
        workflow.add_node("tools", execute_tools_node)
        workflow.add_node("simulate", simulate_node)
        workflow.add_node("finalize", finalize_node)

        # Flow
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
                return "decide"

        workflow.add_conditional_edges(
            "simulate", 
            check_simulation_result, 
            {"finalize": "finalize", "decide": "decide"}
        )
        
        workflow.add_edge("finalize", END)
        final_plan = workflow.compile()
        print("final_plan(Water): ", final_plan)
        return final_plan

    # 🟢 UPDATE 2: Accept image_b64 and pass to state
    def reason(self, sensors, research, strategy, history="None", image_b64=None):
        """Entry point called by main_agent.py"""
        
        initial_state = {
            "sensors": sensors,
            "research_context": research,
            "strategy": strategy,
            "history": history,
            "image_b64": image_b64, # 🟢 Stored in state for injection
            "retry_count": 0,
            "critique": None,
            "messages": [] 
        }
        
        result = self.app.invoke(initial_state)
        return result.get("final_action", {})