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
from sub_agents.atmospheric_agent import AtmosphericAgent
from sub_agents.water_agent import WaterAgent
from sub_agents.Researcher import ResearcherAgent 
from sub_agents.Supervisor import SupervisorAgent

# Simulator Action URL
SIMULATOR_ACTION_URL = "https://unexhumed-melaine-bouncingly.ngrok-free.dev/simulation/action"

def main():
    print("🚀 Initializing Demeter Orchestrator...")
    
    # 1. Instantiate All Agents
    try:
        fetcher = FetchingAgent()
        researcher = ResearcherAgent()
        atmos_agent = AtmosphericAgent()
        water_agent = WaterAgent()
        supervisor = SupervisorAgent()
    except Exception as e:
        print(f"❌ Error initializing agents: {e}")
        return

    while True:
        print("\n" + "="*50)
        print("⏱️  STARTING NEW CYCLE")
        print("="*50)
        
        # 2. Fetch Reality (Current State + History)
        # fetcher returns: (FMU object, sensors dict, history list)
        fmu, sensor_snapshot, history = fetcher.fetch_and_process()
        
        if not fmu:
            print("❌ Fetch failed or Simulator offline. Retrying in 10s...")
            time.sleep(10)
            continue

        # Extract Context
        crop = fmu.metadata.get("crop", "unknown")
        stage = fmu.metadata.get("stage", "unknown")
        
        print(f"\n[Context] Crop: {crop} | Stage: {stage}")
        print(f"[Context] Current Sensors: {sensor_snapshot}")

        # 3. Get Research Knowledge
        # FIX: Adapted to use the 'search' method from your Researcher.py
        search_query = f"optimal hydroponic conditions for {crop} in {stage} stage"
        print(f"\n[Researcher] 🔎 Searching knowledge base for: '{search_query}'...")
        
        research_context = researcher.search(search_query)
        
        # 4. Domain Agent Reasoning
        # They analyze the SENSORS against the RESEARCH
        print("\n🧠 Domain Agents Deliberating...")
        
        # Atmospheric Agent (Controls CO2, Light, Air Temp, Humidity)
        atmos_plan = atmos_agent.reason(sensor_snapshot, research_context)
        print(f"   👉 Atmospheric Plan: {atmos_plan}")

        # Water Agent (Controls pH, EC, Water Temp)
        water_plan = water_agent.reason(sensor_snapshot, research_context)
        print(f"   👉 Water Plan: {water_plan}")

        # 5. Supervisor Synthesis & Validation
        # Merges plans and checks against HISTORY for safety
        print("\n👮 Supervisor Validating...")
        final_action = supervisor.synthesize_plan(
            atmos_plan, 
            water_plan, 
            fmu.metadata, 
            history
        )

        print(f"🎯 FINAL COMMAND: {final_action}")

        # 6. Execute (Send to Simulator)
        try:
            print(f"📡 Sending command to Simulator...")
            resp = requests.post(SIMULATOR_ACTION_URL, json=final_action)
            
            if resp.status_code == 200:
                print("✅ Action accepted by Simulator.")
            else:
                print(f"⚠️ Simulator rejected action: {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"❌ Connection error: {e}")

        # Wait for next cycle
        print("\nzzz Sleeping 15s...")
        time.sleep(15)

if __name__ == "__main__":
    main()