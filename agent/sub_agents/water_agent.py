import os
from langchain_openai import AzureChatOpenAI
from langgraph.graph import StateGraph, END

# Graph State & Nodes
from agent.sub_agents.water_and_atmospheric_dependencies.state import AgentState
from agent.sub_agents.water_and_atmospheric_dependencies.nodes import decide_node, simulate_node, finalize_node, execute_tools_node

# Tools
from agent.sub_agents.water_and_atmospheric_dependencies.retrieval import ask_historian, ask_rag, diagnose_plant, ask_memory
from agent.sub_agents.water_and_atmospheric_dependencies.tools import check_ph_safety, web_search

# 🛡️ GUARDRAILS
from agent.guardrails.validation import sanitize_input, validate_plan, create_validation_report

# Configuration
API_KEY = os.environ.get("AZURE_OPENAI_API_KEY")
ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")
DEPLOYMENT_NAME = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1")
API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

# �️ === WATER & NUTRIENT SPECIALIST (FARM-ONLY MODE) ===
WATER_PROMPT = """
 === WATER & NUTRIENT SPECIALIST (FARM-ONLY MODE) ===

YOUR ROLE:
You are an AI specialist controlling ONLY the water chemistry of a hydroponic farm.
Your SOLE purpose is to maintain optimal nutrient uptake through pH, EC, and water temperature.

 HARD CONSTRAINTS (NON-NEGOTIABLE):
1. pH: MUST stay between 4.0 and 7.5
2. EC (Electrical Conductivity): MUST be between 0.1 and 3.0 dS/m
3. Water Temperature: MUST be between 12°C and 28°C

 OPTIMIZATION TARGETS:
- pH: 5.5-6.5 (vegetables) or 6.0-7.0 (herbs) - NEVER shift >0.5 in one cycle
- EC: Crop-specific ranges within 0.1-3.0 bounds
- Water Temp: 20-24°C optimal (prevent root rot if >24°C)

 CURRENT STATE:
Sensors: {sensors}
Strategy: {strategy}
Research: {research}
History: {history}
Simulation Feedback: {critique}
Visual Data: Available via 'diagnose_plant' tool if leaf yellowing/issues detected

 OUTPUT REQUIREMENTS:
- Return ONLY valid JSON with exactly these keys: 'ph', 'ec', 'water_temp'
- All values must be NUMBERS within the hard constraints above
- NO markdown, NO code blocks, NO explanations, NO text outside JSON
- Invalid JSON will be REJECTED and cause a retry

 FORBIDDEN:
- Do NOT attempt to control air, light, or CO₂
- Do NOT make suggestions unrelated to water chemistry
- Do NOT return anything except the JSON object
- Do NOT exceed hard constraint bounds under any circumstance

 TIP: Call 'diagnose_plant()' (with no arguements) if you suspect nutrient deficiency(e.g. yellowing leaves) or root rot
 
"""

class WaterAgent:
    def __init__(self):
        self.name = "Water Agent"
        
        # 1. Initialize Model
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
      #  print(f"\n[{self.name}] Final Result: {result}")
        return result.get("final_action", {})