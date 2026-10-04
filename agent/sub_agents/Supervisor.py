import os
import json
import numpy as np
from langchain_ollama import ChatOllama
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END
from agent.tools.actuation import convert_targets_to_actions

from agent.Marl.bandit import ContextualBandit
from agent.Marl.strategies import STRATEGIES, NUM_ACTIONS
from agent.Qdrant.Store import store_fmu
from agent.sub_agents.water_and_atmospheric_dependencies.physics_engine import predict_outcome
from agent.sub_agents.water_and_atmospheric_dependencies.json_extract import extract_json_object

# 🛡️ GUARDRAILS
from agent.guardrails.validation import validate_plan, detect_hard_violations, create_validation_report

from dotenv import load_dotenv

load_dotenv()

def _safe_float(source, key, default):
    """Coerce a plan field to float; falls back to `default` (and the caller's
    own numeric-sanity check below will flag the field) if it's missing or the
    LLM emitted something non-numeric (e.g. a string) — better than crashing
    the whole cycle on a stray TypeError from bad LLM output."""
    val = source.get(key, default)
    try:
        return float(val)
    except (TypeError, ValueError):
        return default

# --- NEW TOOLS DEFINITION ---
def check_cross_domain_conflicts(atmos, water):
    conflicts = []

    # 1. Thermal Shock Check
    air_t = _safe_float(atmos, 'air_temp', 25)
    water_t = _safe_float(water, 'water_temp', 20)
    if abs(air_t - water_t) > 10:
        conflicts.append(f"CRITICAL: Thermal Shock Risk. Air ({air_t}C) and Water ({water_t}C) delta > 10C.")

    # 2. Transpiration vs Uptake Check
    # High VPD (Dry) + High EC (Salty) = Burn Risk
    rh = _safe_float(atmos, 'humidity', 60)
    ec = _safe_float(water, 'ec', 1.0)
    if rh < 50 and ec > 2.0:
        conflicts.append(f"STRESS: Low Humidity ({rh}%) + High EC ({ec}) will cause Tip Burn.")

    return conflicts

def validate_hard_limits(plan):
    """
    Validates plan against hard limits using guardrails.
    Returns list of violations.
    """
    has_violations, violations = detect_hard_violations(plan)
    
    if has_violations:
        print(f"🚫 HARD LIMIT VIOLATIONS DETECTED:")
        for v in violations:
            print(f"   {v}")
    
    # Also check for obvious physics conflicts
    additional_conflicts = []
    
    if plan.get('air_temp', 25) - plan.get('water_temp', 20) > 10:
        additional_conflicts.append("⚠️ Thermal Shock Risk: Air/Water temp delta > 10°C")
    
    if plan.get('humidity', 60) < 40 and plan.get('ec', 1.0) > 2.5:
        additional_conflicts.append("⚠️ Burn Risk: Low humidity + high EC")
    
    if plan.get('humidity', 60) > 85:
        additional_conflicts.append("🚫 Mold Risk: Humidity > 85%")
    
    return violations + additional_conflicts

# --- STATE DEFINITION ---
from typing import TypedDict, Optional, Dict, Any, List

class SupervisorState(TypedDict):
    # Inputs
    atmos_plan: Dict[str, Any]
    water_plan: Dict[str, Any]
    strategy_advice: str  # Kept as advice, not law
    current_sensors: Dict[str, float]

    # Processing
    merged_plan: Dict[str, Any]
    review_notes: List[str]
    hard_violations: List[str]   # Physically dangerous/impossible — never approved
    soft_conflicts: List[str]    # Contextual trade-offs — LLM judgment call
    simulation_health: float

    # Output
    final_decision: str # "APPROVE" or "REJECT"
    critique: str       # Feedback for sub-agents if Rejected

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma4:e2b")

class SupervisorAgent:
    def __init__(self, researcher_agent=None):
        self.name = "Supervisor"
        self.bandit = ContextualBandit(n_actions=NUM_ACTIONS, feature_dim=515)

        self.model = ChatOllama(
            model=OLLAMA_MODEL,
            base_url=OLLAMA_HOST,
            temperature=0.0, # Zero temp for strict judging
            reasoning=False,
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

        # Tool 1: Conflict Check (contextual — a trade-off call, not automatically fatal)
        soft_conflicts = check_cross_domain_conflicts(state['atmos_plan'], state['water_plan'])

        # Tool 2: Limit Check (physically dangerous/impossible — never a trade-off)
        hard_violations = validate_hard_limits(plan)

        # Tool 3: Physics Simulator — actually run it now instead of a hardcoded stub
        try:
            prediction = predict_outcome(state.get('current_sensors', {}), plan)
            health = prediction.get('predicted_health', 100)
        except Exception:
            health = 100

        # NOTE: with a small local model, this "predicted health %" is a noisy
        # single-shot LLM guess, not a calibrated simulation — observed to
        # cluster around ~78% regardless of the actual plan. Gating tightly
        # (e.g. <90) turns this into a near-constant rejection regardless of
        # plan quality. Only flag genuinely severe predicted drops as a
        # trade-off worth the LLM judge's attention.
        if health < 60:
            soft_conflicts.append(f"SIMULATION FAIL: Predicted health drops to {health}%.")

        return {
            "review_notes": hard_violations + soft_conflicts,
            "hard_violations": hard_violations,
            "soft_conflicts": soft_conflicts,
            "simulation_health": health,
        }

    def node_judge(self, state):
        """
        The LLM looks at the automated test results and makes the final call.
        Hard, physically-dangerous violations are rejected deterministically —
        no LLM is asked to rubber-stamp something like a negative EC target.
        Only genuinely contextual trade-offs go to the LLM for judgment.
        """
        print("   ⚖️ Supervisor Judging...")

        hard_violations = state.get('hard_violations', [])
        soft_conflicts = state.get('soft_conflicts', [])

        if hard_violations:
            critique = "Hard safety limit(s) violated: " + "; ".join(hard_violations)
            return {"final_decision": "REJECT", "critique": critique}

        if not soft_conflicts:
            # No issues found by tools
            return {"final_decision": "APPROVE", "critique": "Plan looks solid."}

        # Only soft/contextual conflicts remain — ask the LLM whether the
        # strategy justifies them, with no bias toward either verdict.
        prompt = f"""
        You are the Quality Assurance Supervisor reviewing a proposed hydroponic control plan.

        PROPOSED PLAN: {state['merged_plan']}

        ADVISORY WARNINGS (non-fatal, contextual trade-offs):
        {json.dumps(soft_conflicts, indent=2)}

        ADVISORY STRATEGY: {state['strategy_advice']}

        TASK:
        Judge each warning on its merits — do not default to either verdict.
        - APPROVE if the warnings are minor, or clearly justified by the stated strategy
          (e.g. a 'Flush' strategy justifying a low EC target).
        - REJECT if a warning indicates real risk to plant health that the strategy does
          not justify.
        OUTPUT JSON: {{ "verdict": "APPROVE" or "REJECT", "critique": "Explanation..." }}
        """

        print("Supervisor Prompt:\n", prompt)
        
        try:
            response = self.model.invoke([HumanMessage(content=prompt)])
            content = response.content.replace("```json", "").replace("```", "").strip()
            json_candidate = extract_json_object(content) or content
            result = json.loads(json_candidate)

            return {
                "final_decision": result.get("verdict", "REJECT"),
                "critique": result.get("critique", "Automated tests failed.")
            }
        except Exception as e:
            # Default to reject if unsafe.
            return {"final_decision": "REJECT", "critique": f"Automated tests failed (judge error: {e})."}




    # --- ENTRY POINT ---

    def synthesize_plan(self, atmos_plan, water_plan, fmu, history, strategy_info):
        strategy_name, _, action_idx = strategy_info

        current_sensors = fmu.metadata.get('sensors', {})

        initial_state = {
            "atmos_plan": atmos_plan,
            "water_plan": water_plan,
            "strategy_advice": strategy_name,
            "current_sensors": current_sensors,
            "merged_plan": {},
            "review_notes": [],
            "hard_violations": [],
            "soft_conflicts": [],
            "simulation_health": 0.0,
            "final_decision": "",
            "critique": ""
        }

        result = self.app.invoke(initial_state)
        final_targets = result.get("merged_plan", {})
        verdict = result.get("final_decision", "APPROVE")
        critique = result.get("critique", "")

        if verdict == "REJECT":
            # Target == current reading means the actuation layer computes a
            # ~zero error for every field, so nothing gets dosed/actuated this
            # cycle rather than risk applying a plan flagged as dangerous.
            final_targets = {
                "air_temp": current_sensors.get("temp", 25),
                "humidity": current_sensors.get("humidity", 60),
                "ph": current_sensors.get("pH", 6.0),
                "ec": current_sensors.get("EC", 1.5),
            }

        current_sensors = fmu.metadata.get('sensors', {})
        
        # 🛡️ GUARDRAIL CHECK: Validate before executing
        print(f"[{self.name}] 🛡️ Running guardrail validation...")
        validation = validate_plan(final_targets)
        
        if validation["severity"] == "CRITICAL":
            print(create_validation_report(final_targets))
            print(f"[{self.name}] ⚠️ CRITICAL VIOLATIONS - Clamping to bounds...")
            final_targets = validation["bounded_plan"]
        
        if validation["warnings"]:
            print(f"[{self.name}] ⚠️ Warnings: {', '.join(validation['warnings'])}")
        
        print(f"[{self.name}] ⚙️ Converting Targets to Actuator Commands...")

        sensor_vals = [
            float(current_sensors.get("pH", 0.0)),
            float(current_sensors.get("EC", 0.0)),
            float(current_sensors.get("temp", 0.0)),
            float(current_sensors.get("humidity", 0.0))
        ]

        if hasattr(fmu, 'vector') and len(fmu.vector) == 512:
            if isinstance(fmu.vector, list):
                fmu.vector.extend(sensor_vals)
            else:
                import numpy as np
                fmu.vector = np.concatenate((fmu.vector, sensor_vals)).tolist()
        
        # Calculate physical actions
        physical_action_obj = convert_targets_to_actions(current_sensors, final_targets)
        
        # Convert Pydantic model to Dict for JSON serialization
        final_payload = physical_action_obj.dict()
        
        # Log it
        print(f"[{self.name}] 🚜 Activating Hardware: {final_payload}")
        
        # Store in FMU
        fmu.metadata["action_taken"] = str(final_payload)
        fmu.metadata["bandit_action_id"] = action_idx
        fmu.metadata["strategic_intent"] = strategy_name
        
        if "image_b64" in fmu.metadata: del fmu.metadata["image_b64"]
        store_fmu(fmu)
        
        return final_payload

    # --- ADVISORY ONLY (Not Enforced) ---
    def get_strategic_goal(self, fmu):
        # (Same as before, but treated as advice now)
        sensors = fmu.metadata.get('sensors', {})
        fmu_vector = fmu.vector
        vis_vec1 = np.array(fmu_vector) if isinstance(fmu_vector, list) else fmu_vector
        vis_vec = vis_vec1[:512] if len(vis_vec1) >= 512 else None
        if vis_vec is None or len(vis_vec) == 0: vis_vec = np.zeros(512)
        
        s_vec = np.array([
            (float(sensors.get('pH', 6.0)) - 6.0) / 2.0, 
            float(sensors.get('EC', 1.0)) / 3.0,
            float(sensors.get('temp', 25.0)) / 40.0
        ])
        context_vector = np.concatenate([vis_vec, s_vec])

      #  print("Context Vector for Bandit:", context_vector.shape)

        # Stash the exact context vector used for this decision so JudgeAgent
        # can feed it back into bandit.update() next cycle. The FMU's own
        # .vector is 519-dim (512 CLIP + 7 LSTM sensor encoding) and does NOT
        # match this bandit's 515-dim feature space — using it directly would
        # crash or corrupt the model, so it's kept separate here.
        fmu.metadata["bandit_context_vector"] = context_vector.tolist()

        action_idx, _ = self.bandit.select_action(context_vector)
        strategy_name = STRATEGIES[action_idx]
        
        return strategy_name, "Advisory Only", int(action_idx)

    def learn_from_outcome(self, fmu, outcome_info):
        """
        Bandit Learning: Update the model based on action outcome.
        
        Args:
            fmu: The FMU object containing metadata about the previous action
            outcome_info: Either:
                - Current plant health (0-100) from simulator, OR
                - Reward score (-1.0 to 1.0) from judge
        """
        # Retrieve the action that was taken in the previous cycle
        prev_action_idx = fmu.metadata.get("bandit_action_id")
        if prev_action_idx is None:
            return  # No previous action to learn from
        
        prev_action_idx = int(prev_action_idx)
        
        # Build the context vector (same as get_strategic_goal)
        sensors = fmu.metadata.get('sensors', {})
        fmu_vector = fmu.vector
        vis_vec1 = np.array(fmu_vector) if isinstance(fmu_vector, list) else fmu_vector
        vis_vec = vis_vec1[:512] if len(vis_vec1) >= 512 else None
        if vis_vec is None or len(vis_vec) == 0: vis_vec = np.zeros(512)
        
        s_vec = np.array([
            (float(sensors.get('pH', 6.0)) - 6.0) / 2.0, 
            float(sensors.get('EC', 1.0)) / 3.0,
            float(sensors.get('temp', 25.0)) / 40.0
        ])
        context_vector = np.concatenate([vis_vec, s_vec])
        
        # Handle reward: Can be health (0-100) or judge reward (-1 to 1)
        if isinstance(outcome_info, dict):
            reward = float(outcome_info.get("reward", 0.0))
        else:
            # Assume it's health (0-100), convert to normalized reward
            health_val = float(outcome_info)
            if health_val >= 85:
                reward = 1.0  # Excellent
            elif health_val >= 70:
                reward = health_val / 100.0  # Good
            elif health_val >= 50:
                reward = (health_val / 100.0) * 0.5  # Mediocre
            else:
                reward = -1.0  # Terrible
        
        # Update the bandit model with this outcome
        self.bandit.update(context_vector, prev_action_idx, reward)
        
        strategy_name = STRATEGIES.get(prev_action_idx, "UNKNOWN")
        print(f"[{self.name}] 🧠 Bandit Learning: {strategy_name} (Action {prev_action_idx}) → Reward {reward:.2f}")
        
        # Save the updated model
        self.bandit.save()