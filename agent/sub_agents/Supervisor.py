import os
import json
import numpy as np
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END

# Imports
from agent.Marl.bandit import ContextualBandit
from agent.Marl.strategies import STRATEGIES, NUM_ACTIONS
from agent.Qdrant.Store import store_fmu
from agent.sub_agents.water_and_atmospheric_dependencies.physics_engine import predict_outcome

# --- NEW TOOLS DEFINITION ---
def check_cross_domain_conflicts(atmos, water):
    conflicts = []
    
    # 1. Thermal Shock Check
    air_t = atmos.get('air_temp', 25)
    water_t = water.get('water_temp', 20)
    if abs(air_t - water_t) > 10:
        conflicts.append(f"CRITICAL: Thermal Shock Risk. Air ({air_t}C) and Water ({water_t}C) delta > 10C.")

    # 2. Transpiration vs Uptake Check
    # High VPD (Dry) + High EC (Salty) = Burn Risk
    rh = atmos.get('humidity', 60)
    ec = water.get('ec', 1.0)
    if rh < 50 and ec > 2.0:
        conflicts.append(f"STRESS: Low Humidity ({rh}%) + High EC ({ec}) will cause Tip Burn.")

    return conflicts

def validate_hard_limits(plan):
    violations = []
    # Hard limits for Lettuce/General Hydroponics
    if plan.get('ph', 6.0) < 5.0: violations.append("pH < 5.0 is toxic.")
    if plan.get('ph', 6.0) > 7.5: violations.append("pH > 7.5 causes lockout.")
    if plan.get('ec', 1.0) > 3.0: violations.append("EC > 3.0 is too high for lettuce.")
    if plan.get('humidity', 60) > 85: violations.append("Humidity > 85% guarantees mold.")
    
    return violations

# --- STATE DEFINITION ---
from typing import TypedDict, Optional, Dict, Any, List

class SupervisorState(TypedDict):
    # Inputs
    atmos_plan: Dict[str, Any]
    water_plan: Dict[str, Any]
    strategy_advice: str  # Kept as advice, not law
    
    # Processing
    merged_plan: Dict[str, Any]
    review_notes: List[str]
    simulation_health: float
    
    # Output
    final_decision: str # "APPROVE" or "REJECT"
    critique: str       # Feedback for sub-agents if Rejected

API_KEY = os.environ.get("GROQ_API_KEY")

class SupervisorAgent:
    def __init__(self, researcher_agent=None):
        self.name = "Supervisor"
        # Bandit is now just an 'Advisor', not an enforcer
        self.bandit = ContextualBandit(n_actions=NUM_ACTIONS, feature_dim=519)
        
        if API_KEY:
            self.model = ChatOpenAI(
                base_url="https://api.groq.com/openai/v1", 
                api_key=API_KEY,
                model="llama-3.3-70b-versatile",
                temperature=0.0 # Zero temp for strict judging
            )
        
        self.app = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(SupervisorState)

        # 1. Merge: Combine the two JSONs
        workflow.add_node("merge", self.node_merge)
        
        # 2. Review: Run the 3 Tools (Conflicts, Limits, Physics)
        workflow.add_node("review", self.node_review)
        
        # 3. Judge: LLM decides if the issues are fatal
        workflow.add_node("judge", self.node_judge)

        # Flow
        workflow.set_entry_point("merge")
        workflow.add_edge("merge", "review")
        workflow.add_edge("review", "judge")
        workflow.add_edge("judge", END)
        
        return workflow.compile()

    # --- NODE FUNCTIONS ---

    def node_merge(self, state):
        print("   🔗 Supervisor Merging Plans...")
        # Simple dictionary merge
        merged = {**state['atmos_plan'], **state['water_plan']}
        return {"merged_plan": merged}

    def node_review(self, state):
        print("   🔍 Supervisor Running Unit Tests...")
        plan = state['merged_plan']
        notes = []

        # Tool 1: Conflict Check
        conflicts = check_cross_domain_conflicts(state['atmos_plan'], state['water_plan'])
        if conflicts:
            notes.extend(conflicts)
            
        # Tool 2: Limit Check
        limits = validate_hard_limits(plan)
        if limits:
            notes.extend(limits)
            
        # Tool 3: Physics Simulator
        # (We reuse your existing prediction engine)
        sim_result = predict_outcome(plan, plan) # Comparing plan vs itself as a snapshot for now
        health = sim_result.get('predicted_health', 100)
        
        if health < 90:
            notes.append(f"SIMULATION FAIL: Predicted health drops to {health}%. Risk: {sim_result.get('risk_warning')}")

        return {"review_notes": notes, "simulation_health": health}

    def node_judge(self, state):
        """
        The LLM looks at the automated test results and makes the final call.
        """
        print("   ⚖️ Supervisor Judging...")
        
        if not state['review_notes']:
            # No issues found by tools
            return {"final_decision": "APPROVE", "critique": "Plan looks solid."}
        
        # If issues exist, ask LLM if they are fatal or acceptable trade-offs
        prompt = f"""
        You are the Quality Assurance Supervisor.
        
        PROPOSED PLAN: {state['merged_plan']}
        
        AUTOMATED TEST FAILURES:
        {json.dumps(state['review_notes'], indent=2)}
        
        ADVISORY STRATEGY: {state['strategy_advice']}
        
        TASK:
        1. If the failures are dangerous (Toxic pH, Thermal Shock, Low Health), REJECT the plan.
        2. If the failures are minor or necessary for the Strategy (e.g., Low Humidity required for 'Fungal Treatment'), APPROVE it.
        
        OUTPUT JSON: {{ "verdict": "APPROVE" or "REJECT", "critique": "Explanation..." }}
        """
        
        try:
            response = self.model.invoke([HumanMessage(content=prompt)])
            content = response.content.replace("```json", "").replace("```", "").strip()
            result = json.loads(content)
            
            return {
                "final_decision": result.get("verdict", "REJECT"),
                "critique": result.get("critique", "Automated tests failed.")
            }
        except:
            # Default to reject if unsafe
            return {"final_decision": "REJECT", "critique": "Plan failed automated safety checks."}

    # --- ENTRY POINT ---

    def synthesize_plan(self, atmos_plan, water_plan, fmu, history, strategy_info):
        strategy_name, _, action_idx = strategy_info
        
        initial_state = {
            "atmos_plan": atmos_plan,
            "water_plan": water_plan,
            "strategy_advice": strategy_name,
            "merged_plan": {},
            "review_notes": [],
            "simulation_health": 0.0,
            "final_decision": "",
            "critique": ""
        }
        
        result = self.app.invoke(initial_state)
        
        final_verdict = result['final_decision']
        final_plan = result['merged_plan']
        critique = result['critique']

        # Handling the "Run them again" logic:
        # Since this method is called by main_agent, we need to return a signal.
        # However, to keep compatibility with your current simulator loop,
        # we might have to force a safe fallback if rejected, OR return a special flag.
        
        if final_verdict == "REJECT":
            print(f"\n❌ SUPERVISOR REJECTED PLAN: {critique}")
            print("   ⚠️ Reverting to SAFE MODE (Standard Maintenance).")
            # Fallback to safe defaults if plans are bad
            final_plan = {
                "ph": 6.0, "ec": 1.2, "water_temp": 20, 
                "co2": 400, "air_temp": 24, "humidity": 60, "light_intensity": 300,
                "decision": "REJECTED_FALLBACK",
                "reasoning": critique
            }
        else:
            print(f"\n✅ SUPERVISOR APPROVED PLAN.")

        # Store Metadata
        fmu.metadata["action_taken"] = str(final_plan)
        fmu.metadata["bandit_action_id"] = action_idx
        fmu.metadata["strategic_intent"] = strategy_name
        
        if "image_b64" in fmu.metadata: del fmu.metadata["image_b64"]
        store_fmu(fmu)
        
        return final_plan

    # --- ADVISORY ONLY (Not Enforced) ---
    def get_strategic_goal(self, fmu):
        # (Same as before, but treated as advice now)
        sensors = fmu.metadata.get('sensor_data', {})
        fmu_vector = fmu.vector
        vis_vec = np.array(fmu_vector) if isinstance(fmu_vector, list) else fmu_vector
        if vis_vec is None or len(vis_vec) == 0: vis_vec = np.zeros(516)
        
        s_vec = np.array([
            (float(sensors.get('pH', 6.0)) - 6.0) / 2.0, 
            float(sensors.get('EC', 1.0)) / 3.0,
            float(sensors.get('temp', 25.0)) / 40.0
        ])
        context_vector = np.concatenate([vis_vec, s_vec])
        
        action_idx, _ = self.bandit.select_action(context_vector)
        strategy_name = STRATEGIES[action_idx]
        
        return strategy_name, "Advisory Only", int(action_idx)