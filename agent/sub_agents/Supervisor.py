import json
import numpy as np
import os

# 1. Internal Engines
from agent.Marl.bandit import ContextualBandit
from agent.Marl.strategies import STRATEGIES, NUM_ACTIONS
from agent.memory import FarmMemory

# 🟢 NEW: Import the Doctor
from agent.sub_agents.Doctor import VisionAgent

class SupervisorAgent:
    def __init__(self, llm_client):
        self.llm = llm_client
        
        # Initialize the Team
        self.bandit = ContextualBandit(n_actions=NUM_ACTIONS, feature_dim=515)
        self.bio_memory = FarmMemory()
        
        # 🟢 NEW: Initialize the Doctor (Eyes)
        self.doctor = VisionAgent()

        # Load saved bandit brain if it exists
        self.model_path = os.path.join(os.path.dirname(__file__), '../Marl/saved_bandit_state.pkl')
        # self.bandit.load(self.model_path)

    def _report_to_vector(self, doctor_report):
        """
        🟢 NEW: Converts the Doctor's JSON report into the 512-dim vector.
        Uses semantic hashing to map specific diseases to specific neurons.
        """
        vis_vec = np.zeros(512)
        
        if "detailed_detections" in doctor_report:
            for detection in doctor_report["detailed_detections"]:
                label = detection["object"]
                confidence = detection["confidence"]
                
                # Hash the label name to an index between 0-511
                idx = hash(label) % 512
                vis_vec[idx] += confidence
                
        return np.clip(vis_vec, 0, 1.0)

    def _build_context(self, visual_vector, sensors):
        """
        🟢 UPDATED: Fuses Vision (512) + 3 
        """
        # Raw Sensor Values
        ph = sensors.get('pH', 6.0)
        ec = sensors.get('EC', 1.0)
        temp = sensors.get('temp', 25.0)

        # 1. Normalize Raw (Direction)
        raw_ph = (ph - 6.0) / 2.0
        raw_ec = (ec - 1.0) / 3.0
        raw_temp = (temp - 25.0) / 40.0

        sensor_features = np.array([
            raw_ph, raw_ec, raw_temp,
        ])
        
        return np.concatenate([visual_vector, sensor_features])

    def _get_strategy_instruction(self, strategy_name):
        """Translates Math Strategy -> Natural Language Orders"""
        instructions = {
            "MAINTAIN_CURRENT": "Do NOT recommend changes. System is stable.",
            "CALIBRATE_SENSORS": "Sensor readings are anomalous. Recommend hardware calibration.",
            "AGGRESSIVE_PH_DOWN": "Priority: LOWER pH rapidly. Recommend strong acid buffers.",
            "AGGRESSIVE_PH_UP": "Priority: RAISE pH rapidly. Recommend strong base buffers.",
            "GENTLE_PH_BALANCING": "pH is drifting. Recommend gentle adjustments only.",
            "INCREASE_EC_VEG": "Plant needs NITROGEN for vegetative growth.",
            "INCREASE_EC_BLOOM": "Plant needs PHOSPHORUS/POTASSIUM for flowering.",
            "LOWER_EC_FLUSH": "Nutrient burn detected. Recommend flushing reservoir.",
            "CALMAG_BOOST": "Calcium/Magnesium deficiency detected. Recommend CalMag supplement.",
            "RAISE_TEMP_HUMIDITY": "Environment too cold/dry. Recommend heating/humidifying.",
            "LOWER_TEMP_HUMIDITY": "Mold risk high. Recommend fans and dehumidifiers.",
            "MAX_AIR_CIRCULATION": "Stagnant air. Recommend max fan speed.",
            "FUNGAL_TREATMENT": "Fungal risk. Recommend fungicide and lower humidity.",
            "PEST_ISOLATION": "Pests detected. Recommend isolation and organic pesticide.",
            "PRUNE_NECROTIC_LEAVES": "Necrosis detected. Recommend pruning dead matter."
        }
        return instructions.get(strategy_name, "Follow standard procedures.")

    def reason(self, current_fmu, similar_fmus, sub_agent_outputs):
        """
        The Core Logic: Synthesizes Bandit (Math), Specialists (Science), 
        Qdrant (History), mem0 (Biography), AND Doctor (Vision).
        """
        payload = current_fmu['payload']
        sensors = payload['sensors']
        
        # 🟢 NEW: Extract Image Path
        image_path = payload.get('image_path', None)
        crop_id = payload.get('crop_id', 'General_Zone_1')

        # ---------------------------------------------------------
        # 0. 🟢 THE DOCTOR (Vision Analysis)
        # ---------------------------------------------------------
        visual_report = {"scan_summary": "No Image Provided", "detailed_detections": []}
        
        if image_path and os.path.exists(image_path):
            print(f"👀 Doctor Analyzing: {image_path}")
            visual_report = self.doctor.analyze_frame(image_path)
            print(f"📋 Visual Report: {visual_report.get('scan_summary')}")
        
        # Convert report to vector for the Bandit
        visual_vector = self._report_to_vector(visual_report)

        # ---------------------------------------------------------
        # 1. 🟢 THE GENERAL (Bandit RL)
        # ---------------------------------------------------------
        # Build 515-dim context (Vision + Advanced Sensors)
        context_vector = self._build_context(visual_vector, sensors)
        
        action_idx, debug_info = self.bandit.select_action(context_vector)
        strategic_intent = STRATEGIES[action_idx]
        specific_order = self._get_strategy_instruction(strategic_intent)
        
        print(f"🎰 Bandit Order: {strategic_intent} (Score: {debug_info['scores'][action_idx]:.2f})")

        # ---------------------------------------------------------
        # 2. 🟢 THE EXPERTS (Mini-Agents)
        # ---------------------------------------------------------
        if "NUTRIENT" in strategic_intent or "PH" in strategic_intent or "EC" in strategic_intent:
            highlighted_report = sub_agent_outputs.get("nutrient_report", "No Report")
            focus_area = "NUTRIENT SPECIALIST"
        elif "TEMP" in strategic_intent or "HUMIDITY" in strategic_intent:
            highlighted_report = sub_agent_outputs.get("atmosphere_report", "No Report")
            focus_area = "ATMOSPHERE SPECIALIST"
        elif "PEST" in strategic_intent or "FUNGAL" in strategic_intent or "PRUNE" in strategic_intent:
            # 🟢 UPDATED: Use the Doctor's report for bio-threats
            highlighted_report = f"Visual Diagnosis: {visual_report.get('scan_summary', 'None')}"
            focus_area = "PLANT DOCTOR"
        else:
            highlighted_report = "Standard operational check."
            focus_area = "ALL SECTORS"

        # ---------------------------------------------------------
        # 3. 🟢 THE HISTORIAN (Qdrant / RAG)
        # ---------------------------------------------------------
        history_context = "No relevant global precedents found."
        if similar_fmus and len(similar_fmus) > 0:
            history_lines = []
            for i, fmu in enumerate(similar_fmus):
                past_action = fmu['payload'].get('action_taken', 'Unknown')
                past_outcome = fmu['payload'].get('outcome', 'Unknown')
                score = fmu.get('score', 0.0)
                history_lines.append(f"- Global Case #{i+1} ({score:.0%} Match): Action '{past_action}' -> Result '{past_outcome}'")
            history_context = "\n".join(history_lines)

        # ---------------------------------------------------------
        # 4. 🟢 THE BIOGRAPHER (mem0 / Entity Memory)
        # ---------------------------------------------------------
        plant_biography = self.bio_memory.get_plant_history(crop_id)

        # ---------------------------------------------------------
        # 5. 🟢 THE COMMANDER (Supervisor LLM)
        # ---------------------------------------------------------
        system_prompt = f"""
        You are the Supervisor of a Hydroponic Farm.
        
        --- 🚨 INPUTS FROM YOUR TEAM 🚨 ---

        [1] INTELLIGENCE REPORT (From {focus_area}):
            "{highlighted_report}"
            *Use these facts to justify the decision.*

        [2] VISUAL DIAGNOSIS (From The Doctor):
            Summary: {json.dumps(visual_report.get('scan_summary'))}
            Detections: {json.dumps(visual_report.get('detailed_detections'))}

        [3] LIVE SENSORS: 
            {json.dumps(sensors)}

        [4] GLOBAL PRECEDENT (Similar Past Situations):
            {history_context}

        [5] FULL CONTEXT:
            All Specialist Reports: {json.dumps(sub_agent_outputs)}

        [6] PATIENT BIOGRAPHY (Specific to {crop_id}):
            {plant_biography}
            *CRITICAL: If this specific plant has a history of sensitivity, adjust the plan.*
        
        [7] STRATEGIC ORDER (From RL): 
            "{strategic_intent}" -> "{specific_order}"
            *This is your just one metric*

        --- 🚨 HIERARCHY OF TRUTH (CRITICAL) 🚨 ---
        1. **LIVE SENSORS**: Absolute truth.
        2. **VISUAL EVIDENCE**: Strong truth (The Doctor sees the plant and checks for sickness).
        3. **BIOGRAPHY**: History (Past truth).

        --- YOUR TASK ---
        Generate a detailed action plan. Synthesize all the inputs.

        --- ✍️ STYLE GUIDELINES ---
        - **Plain English Only.**
        - **Tone:** Professional, decisive, and clear.
        
        RESPONSE FORMAT (JSON):
        {{
            "decision": "Brief, actionable summary",
            "reasoning": "Detailed explanation synthesizing Strategy + Visuals + History...",
            "visual_alert": true/false,
            "risk_matrix": {{ "nutrients": 0-10, "climate": 0-10, "visuals": 0-10, "history": 0-10 }}
        }}
        """
        
        try:
            response = self.llm.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Current Sensors: {json.dumps(sensors)}"}
                ],
                response_format={"type": "json_object"}
            )
            decision_json = json.loads(response.choices[0].message.content)
            
            # ---------------------------------------------------------
            # 6. 🟢 CLOSE THE LOOP (Log to mem0)
            # ---------------------------------------------------------
            log_entry = f"Condition: {strategic_intent}. Visuals: {visual_report.get('scan_summary')}. Action: {decision_json['decision']}."
            self.bio_memory.log_event(crop_id, log_entry)

            # Attach Metadata for RL Training later
            decision_json["strategic_intent"] = strategic_intent
            decision_json["bandit_action_idx"] = int(action_idx)
            decision_json["visual_report"] = visual_report
            
            return decision_json

        except Exception as e:
            return {
                "decision": f"Execute Standard Protocol: {strategic_intent}",
                "reasoning": f"LLM Generation Failed ({str(e)}). Defaulting to Bandit Strategy.",
                "strategic_intent": strategic_intent,
                "bandit_action_idx": int(action_idx)
            }
