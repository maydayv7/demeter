# agent/sub_agents/Supervisor.py

import json
import numpy as np

# 👇 CORRECT IMPORTS based on your folder structure
from agent.Marl.bandit import ContextualBandit
from agent.Marl.strategies import STRATEGIES, NUM_ACTIONS

class SupervisorAgent:
    def __init__(self, researcher):
        self.llm = researcher.llm
        
        # Initialize Bandit (15 actions, 515 dimensions)
        self.bandit = ContextualBandit(n_actions=NUM_ACTIONS, feature_dim=519)

    def _build_context(self, fmu_vector, sensors):
        """
        Combines Visual Intuition (CLIP) with Explicit Sensors.
        """
        # Ensure vector is numpy
        vis_vec = np.array(fmu_vector) if isinstance(fmu_vector, list) else fmu_vector
        
        # Normalize sensors roughly to 0-1 range
        s_vec = np.array([
            (sensors.get('pH', 6.0) - 6.0) / 2.0, 
            sensors.get('EC', 1.0) / 3.0,
            sensors.get('temp', 25.0) / 40.0
        ])
        
        return np.concatenate([vis_vec, s_vec])

    def _get_strategy_instruction(self, strategy_name):
        """
        Translates mathematical intent into LLM instructions.
        """
        instructions = {
            "MAINTAIN_CURRENT": "Do NOT recommend changes. System is stable.",
            "CALIBRATE_SENSORS": "Sensor readings are anomalous. Recommend hardware calibration.",
            "AGGRESSIVE_PH_DOWN": "Priority: LOWER pH rapidly. Recommend strong acid buffers.",
            "AGGRESSIVE_PH_UP": "Priority: RAISE pH rapidly. Recommend strong base buffers.",
            "GENTLE_PH_BALANCING": "pH is drifting. Recommend gentle adjustments only.",
            "INCREASE_EC_VEG": "Plant needs NITROGEN for vegetative growth.",
            "INCREASE_EC_BLOOM": "Plant needs PHOSPHORUS/POTASSIUM for flowering.",
            "LOWER_EC_FLUSH": "Nutrient burn detected. Recommend flushing reservoir.",
            "CALMAG_BOOST": "Deficiency detected. Recommend Calcium/Magnesium supplement.",
            "RAISE_TEMP_HUMIDITY": "Environment too cold/dry. Recommend heating/humidifying.",
            "LOWER_TEMP_HUMIDITY": "Mold risk high. Recommend fans and dehumidifiers.",
            "MAX_AIR_CIRCULATION": "Stagnant air. Recommend max fan speed.",
            "FUNGAL_TREATMENT": "Fungal risk. Recommend fungicide and lower humidity.",
            "PEST_ISOLATION": "Pests detected. Recommend isolation and organic pesticide.",
            "PRUNE_NECROTIC_LEAVES": "Necrosis detected. Recommend pruning dead matter."
        }
        return instructions.get(strategy_name, "Follow standard procedures.")

    def reason(self, current_fmu, similar_fmus, sub_agent_outputs):
        sensors = current_fmu['payload']['sensors']
        fmu_vector = current_fmu.get('vector') 

        if fmu_vector is None:
            fmu_vector = np.zeros(512)

        # 1. 🟢 GET CONTEXT
        context_vector = self._build_context(fmu_vector, sensors)
        
        # 2. 🟢 BANDIT DECISION (The "Will")
        action_idx, debug_info = self.bandit.select_action(context_vector)
        strategic_intent = STRATEGIES[action_idx]
        specific_order = self._get_strategy_instruction(strategic_intent)
        
        # 3. 🟢 IDENTIFY RELEVANT SPECIALIST (The "Physics")
        if "NUTRIENT" in strategic_intent or "PH" in strategic_intent or "EC" in strategic_intent:
            highlighted_report = sub_agent_outputs.get("nutrient_report", "No Report")
            focus_area = "NUTRIENT SPECIALIST"
        elif "TEMP" in strategic_intent or "HUMIDITY" in strategic_intent or "AIR" in strategic_intent:
            highlighted_report = sub_agent_outputs.get("atmosphere_report", "No Report")
            focus_area = "ATMOSPHERE SPECIALIST"
        elif "PEST" in strategic_intent or "FUNGAL" in strategic_intent:
            highlighted_report = "Visual analysis indicates bio-threats."
            focus_area = "BIO-SECURITY"
        else:
            highlighted_report = "Standard operational check."
            focus_area = "ALL SECTORS"

        # 4. 🟢 FORMAT HISTORY (The "Precedent") <--- NEW SECTION
        history_context = "No relevant historical cases found."
        if similar_fmus and len(similar_fmus) > 0:
            history_lines = []
            for i, fmu in enumerate(similar_fmus):
                # Extract key details from the past record
                past_action = fmu['payload'].get('action_taken', 'Unknown')
                past_outcome = fmu['payload'].get('outcome', 'Unknown')
                score = fmu.get('score', 0.0)
                history_lines.append(f"- Case #{i+1} (Match: {score:.1%}): Action '{past_action}' -> Result: '{past_outcome}'")
            history_context = "\n".join(history_lines)

        # 5. 🟢 SYNTHESIS PROMPT
        system_prompt = f"""
        You are the Supervisor of a Hydroponic Farm.
        
        --- 🚨 CHAIN OF COMMAND INSTRUCTIONS 🚨 ---
        
        1. STRATEGIC GOAL (From RL General): 
           "{strategic_intent}" -> "{specific_order}"
           *This is your MANDATORY objective.*

        2. INTELLIGENCE REPORT (From {focus_area}):
           "{highlighted_report}"
           *Use these specific calculations (VPD, Lockout, etc.) to justify your plan.*

        3. HISTORICAL PRECEDENT (Retrieval Memory):
           {history_context}
           *Reference these past cases to support (or warn against) specific implementation details.*

        4. FULL CONTEXT:
           Other Reports: {json.dumps(sub_agent_outputs)}
           
        --- YOUR TASK ---
        Generate a specific action plan that executes the Strategic Goal.
        
        CRITICAL: You must synthesize the RL Order, the Physics Report, and the History.
        - If History shows the RL Strategy failed recently, mention that risk and propose a safer variation.
        - If History confirms success, cite it to build confidence.
        
        RESPONSE FORMAT (JSON):
        {{
            "decision": "Brief summary",
            "reasoning": "Detailed synthesis of Logic + Physics + History...",
            "risk_matrix": {{ "nutrients": 5, "climate": 5, "visuals": 5, "history": 5 }}
        }}
        """

        try:
            response = self.llm.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Sub-Agent Reports: {json.dumps(sub_agent_outputs)}"}
                ],
                response_format={"type": "json_object"}
            )
            decision_json = json.loads(response.choices[0].message.content)
            
            # 🟢 Attach Metadata for Training
            decision_json["strategic_intent"] = strategic_intent
            decision_json["bandit_action_idx"] = int(action_idx)
            
            return decision_json

        except Exception as e:
            return {
                "decision": "Error in reasoning",
                "reasoning": str(e),
                "strategic_intent": strategic_intent,
                "bandit_action_idx": int(action_idx)
            }