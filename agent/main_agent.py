import sys
import os
import requests
import time
from pathlib import Path

# --- PATH SETUP ---
# Adds the current directory (agent/) to sys.path so we can import sub_agents and Qdrant
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# Import Agents
from sub_agents.fetching_agent import FetchingAgent
from sub_agents.judge_agent import JudgeAgent  # 🆕 Import Judge
from sub_agents.atmospheric_agent import AtmosphericAgent
from sub_agents.water_agent import WaterAgent
from sub_agents.Researcher import ResearcherAgent 
from sub_agents.Supervisor import SupervisorAgent

# Simulator Action URL
# Updated to localhost to match the simulator we just created
SIMULATOR_ACTION_URL = "https://unexhumed-melaine-bouncingly.ngrok-free.dev/simulation/action"

def main():
    print("🚀 Initializing Demeter Orchestrator (Judge-Review -> Supervisor-Store)...")
    
    try:
        fetcher = FetchingAgent()
        judge = JudgeAgent()
        researcher = ResearcherAgent()
        atmos_agent = AtmosphericAgent()
        water_agent = WaterAgent()
        supervisor = SupervisorAgent()
    except Exception as e:
        print(f"❌ Init Error: {e}")
        return

    while True:
        print("\n" + "="*50)
        print("⏱️  STARTING NEW CYCLE")
        print("="*50)
        
        # 1. Fetch Reality (Seq N)
        fmu, sensor_snapshot, history = fetcher.fetch_and_process()
        
        if not fmu:
            print("❌ Fetch failed. Retrying in 10s...")
            time.sleep(10)
            continue

        # 2. Judge Reviews History (Updates Seq N-1)
        # Does NOT store current FMU yet
        judge.review_previous_cycle(fmu)

        # 3. Research & Reasoning
        crop = fmu.metadata.get("crop", "unknown")
        stage = fmu.metadata.get("stage", "unknown")
        query = f"optimal hydroponic conditions for {crop} in {stage} stage"
        
        research_context = researcher.search(query)
        
        print("\n🧠 Domain Agents Deliberating...")
        atmos_plan = atmos_agent.reason(sensor_snapshot, research_context)
        water_plan = water_agent.reason(sensor_snapshot, research_context)

        # 4. Supervisor Decides & STORES Reality (Seq N)
        # Now passes the full 'fmu' object so Supervisor can save it
        print("\n👮 Supervisor Validating & Storing...")
        final_action = supervisor.synthesize_plan(
            atmos_plan, 
            water_plan, 
            fmu,   # <--- Passing full FMU object
            history
        )

        print(f"🎯 FINAL COMMAND: {final_action}")

        # 5. Execute
        try:
            requests.post(SIMULATOR_ACTION_URL, json=final_action)
            print("✅ Action sent to Simulator.")
        except Exception as e:
            print(f"❌ Connection error: {e}")

        print("\nzzz Sleeping 15s...")
        time.sleep(15)

if __name__ == "__main__":
    main()