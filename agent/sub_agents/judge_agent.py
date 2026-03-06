import os
import json
import base64
import re
import tempfile
from typing import TypedDict, Dict, Any, Optional

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END
from qdrant_client import models

from Sentinel.fmu import FMU
from agent.sub_agents.base_agent import BaseReasoningAgent
from Qdrant.Client import client
from Qdrant.Store import COLLECTION_NAME

# Import farm_memory to allow writing verdicts
from agent.sub_agents.water_and_atmospheric_dependencies.retrieval import diagnose_plant, ask_memory, farm_memory

# --- STATE DEFINITION ---
class JudgeState(TypedDict):
    # Inputs
    current_fmu: Any     
    image_b64: str          # Added to State
    
    # Internal Context
    prev_point: Any      
    crop_id: str
    
    # Forensic Evidence
    visual_report: Dict 
    biography: Any      
    
    # Verdict
    reward: float        
    outcome: str         
    explanation: str     
    
    # Output
    training_data: Optional[Dict]

class JudgeAgent(BaseReasoningAgent):
    def __init__(self):
        super().__init__(name="Judge Agent")
        self.qdrant = client
        
        # LLM for the "Deliberation" phase
        self.llm = ChatOpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=os.environ.get("GROQ_API_KEY"),
            model="qwen/qwen3-32b",
            temperature=0.1
        )
        
        self.app = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(JudgeState)
        workflow.add_node("retrieve_evidence", self.node_retrieve_evidence)
        workflow.add_node("run_forensics", self.node_run_forensics)
        workflow.add_node("deliberate", self.node_deliberate)
        workflow.add_node("file_verdict", self.node_file_verdict)

        workflow.set_entry_point("retrieve_evidence")
        
        workflow.add_conditional_edges(
            "retrieve_evidence",
            lambda x: "run_forensics" if x.get("prev_point") else "end_no_history",
            {
                "run_forensics": "run_forensics",
                "end_no_history": END
            }
        )
        
        workflow.add_edge("run_forensics", "deliberate")
        workflow.add_edge("deliberate", "file_verdict")
        workflow.add_edge("file_verdict", END)

        return workflow.compile()

    # --- NODES ---

    def node_retrieve_evidence(self, state: JudgeState):
        print(f"[{self.name}] 🕵️ Retrieve Evidence...")
        fmu = state["current_fmu"]
        crop_id = fmu.metadata.get("crop_id")
        current_seq = fmu.metadata.get("sequence_number", 1)
        
        if current_seq <= 1:
            print("   -> First cycle. No history to judge.")
            return {"prev_point": None}

        prev_seq = current_seq - 1
        try:
            s_filter = models.Filter(
                must=[
                    models.FieldCondition(key="crop_id", match=models.MatchValue(value=crop_id)),
                    models.FieldCondition(key="sequence_number", match=models.MatchValue(value=prev_seq))
                ]
            )
            res, _ = self.qdrant.scroll(
                collection_name=COLLECTION_NAME, 
                scroll_filter=s_filter, 
                limit=1, 
                with_vectors=True
            )
            return {"prev_point": res[0] if res else None, "crop_id": crop_id}
        except Exception as e:
            print(f"   -> DB Error: {e}")
            return {"prev_point": None}

    def node_run_forensics(self, state: JudgeState):
        """
        Executes the TWO mandated tools: diagnose_plant and ask_memory.
        """
        print(f"[{self.name}] 🔎 Running Forensics...")
        crop_id = state["crop_id"]
        image_b64 = state.get("image_b64")

        # --- TOOL 1: diagnose_plant ---
        visual_data = {"status": "No Image"}
        if image_b64:
            try:
                with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp:
                    temp.write(base64.b64decode(image_b64))
                    temp_path = temp.name

                print(f"   -> Invoking Tool inside: diagnose_plant")
                visual_data = diagnose_plant.invoke({"image_b64": image_b64})
                os.remove(temp_path)
            except Exception as e:
                visual_data = {"error": str(e)}
        else:
             print("   -> No image found for diagnosis.")
        
        # --- TOOL 2: ask_memory ---
       # print(f"   -> Invoking Tool: ask_memory for '{crop_id}'")
        try:
            # We updated the tool to expect 'plant_id', so we must pass that key
            raw_memory = ask_memory.invoke({"plant_id": crop_id})
            # FIX: Force conversion to string to ensure it renders in prompt
        #    print(f"   -> Memory Retrieved: '{raw_memory}'")
            memory_data = str(raw_memory)
            
        #    print(f"   -> Memory Retrieved {memory_data}")
            self
        except Exception as e:
            print(f"   -> Memory Tool Error: {e}")
            memory_data = "Memory unavailable."
        
        # Explicitly return the dict to update state keys
        return {
            "visual_report": visual_data,
            "biography": memory_data
        }

    def node_deliberate(self, state: JudgeState):
        """
        LLM synthesizes Visual + History + Sensor Delta to form a verdict.
        """
        print(f"[{self.name}] ⚖️ Deliberating...")

        # --- DEBUG: Verify State Content ---
        # print(f"DEBUG CHECK -> Biography Content: '{state.get('biography')}'")
        
        prev_sensors = state["prev_point"].payload.get("sensors", {})
        curr_sensors = state["current_fmu"].metadata.get("sensors", {})
        visual = state["visual_report"]
        
        # Ensure history is never None
        history = state.get("biography", "No history available.")
        
        prompt = f"""
        You are the Chief Judge of an Automated Farm.
        Evaluate the result of the LAST ACTION based on the transition from State N-1 to State N.

        --- EVIDENCE ---
        PREVIOUS SENSORS (N-1): {prev_sensors}
        CURRENT SENSORS (N): {curr_sensors}
        
        VISUAL AUTOPSY (Doctor's Report):
        {json.dumps(visual, indent=2)}
        
        PLANT BIOGRAPHY (Past Issues):
        {history}

        --- RUBRIC ---
        1. IF Doctor found "DISEASE_DETECTED": Reward = -1.0 (Critical Failure).
        2. IF Doctor found "HEALTHY" AND Sensors moved closer to targets: Reward = 0.5 to 1.0.
        3. IF Sensors drifted away from targets: Reward = -0.5.
        
        TASK:
        Output JSON: {{ "outcome": "IMPROVED"|"DETERIORATED"|"STABLE", "reward": float(-1.0 to 1.0), "reason": "Short explanation" }}
        """
        
       # print("Judge Prompt:\n", prompt)
        try:
            response = self.llm.invoke([HumanMessage(content=prompt)])
          #  print(f"   -> LLM Response for Judge Deliberation: {response.content}")
            content = response.content.strip()

         #   print(f"   -> Raw LLM Output: '{content}'")
            code_block_match = re.search(r"```json\s*(\{.*?\})\s*```", content, re.DOTALL)
            
            if code_block_match:
                json_str = code_block_match.group(1)
            else:
                # 2. Fallback: Find the first '{' and the last '}'
                # This handles cases where the LLM forgets the ```json tags
                json_match = re.search(r"\{.*\}", content, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    raise ValueError(f"No JSON found in response: {content[:50]}...")

            # 3. Parse
            verdict = json.loads(json_str)
            
            print(f"   -> Verdict: {verdict.get('outcome')} ({verdict.get('reward')})")
            return {
                "outcome": verdict.get("outcome", "STABLE"),
                "reward": verdict.get("reward", 0.0),
                "explanation": verdict.get("reason", "Analysis complete.")
            }
        except Exception as e:
            print(f"   -> Deliberation Failed: {e}")
            return {"outcome": "ERROR", "reward": 0.0, "explanation": "Judge LLM failed."}

    def node_file_verdict(self, state: JudgeState):
        """
        Writes the final judgment to Qdrant AND FarmMemory.
        """
        print(f"[{self.name}] 📝 Filing Verdict...")
        
        prev_id = state["prev_point"].id
        crop_id = state["crop_id"]
        
        # 1. Update Qdrant Snapshot
        self.qdrant.set_payload(
            collection_name=COLLECTION_NAME,
            points=[prev_id],
            payload={
                "outcome": f"{state['outcome']} | Reward: {state['reward']}",
                "reward_score": state['reward'],
                "explanation_log": state["explanation"],
                "visual_diagnosis": str(state["visual_report"].get("health_assessment", "N/A"))
            }
        )

        # 2. Write to FarmMemory (Text/Biography Store)
        try:
            verdict_summary = (
                f"Cycle Review for {crop_id}: Result was {state['outcome']} "
                f"(Reward: {state['reward']}). Judge's Note: {state['explanation']}"
            )
            farm_memory.log_event(crop_id, verdict_summary)
        except Exception as e:
            print(f"   -> ⚠️ Failed to log to FarmMemory: {e}")
        
        # Prepare Training Data Bundle
        training_data = {
            "reward": state['reward'],
            "prev_action_idx": state["prev_point"].payload.get("bandit_action_id"),
            "prev_vector": state["prev_point"].vector,
            "prev_sensors": state["prev_point"].payload.get("sensor_data", {})
        }
        
        return {"training_data": training_data}

    # --- ENTRY POINT ---
    def review_previous_cycle(self, current_fmu: FMU, image_b64: str):
        initial_state = {
            "current_fmu": current_fmu,
            "image_b64": image_b64,
            "prev_point": None,
            "crop_id": "",
            "visual_report": {},
            "biography": "", # Starts empty
            "reward": 0.0,
            "outcome": "",
            "explanation": "",
            "training_data": None
        }
        
        result = self.app.invoke(initial_state)
        return result.get("training_data")