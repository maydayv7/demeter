import sys
import os
import requests
import time

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from sub_agents.fetching_agent import FetchingAgent
from sub_agents.judge_agent import JudgeAgent
from sub_agents.atmospheric_agent import AtmosphericAgent
from sub_agents.water_agent import WaterAgent
from sub_agents.Researcher import ResearcherAgent 
from sub_agents.Supervisor import SupervisorAgent

# Update this URL to your running simulator instance
SIMULATOR_ACTION_URL = "https://unexhumed-melaine-bouncingly.ngrok-free.dev/simulation/action"

def main():
    print("🚀 Initializing Demeter Orchestrator...")
    
    try:
        fetcher = FetchingAgent()
        judge = JudgeAgent()
        researcher = ResearcherAgent()
        atmos_agent = AtmosphericAgent()
        water_agent = WaterAgent()
        # Pass researcher so Supervisor can share the RAG tools if needed
        supervisor = SupervisorAgent(researcher_agent=researcher) 
        
        print("✅ Agents Online.")
    except Exception as e:
        print(f"❌ Init Error: {e}")
        return

    while True:
        print("\n" + "="*50)
        print("⏱️  STARTING NEW CYCLE")
        print("="*50)
        
        # 1. Fetch
        fmu, sensor_snapshot, history, image_b64 = fetcher.fetch_and_process()
        if not fmu:
            print("⚠️ No FMU found. Waiting...")
            time.sleep(10)
            continue

        # 2. Judge
        time.sleep(2) # Small delay to ensure FMU is fully available before judging
        judge.review_previous_cycle(fmu, image_b64)

        # 3. 🟢 GET BANDIT STRATEGY (The Brain)
        # The Supervisor consults the Bandit first to set the cycle's goal
        time.sleep(2) # Ensure judge's review is complete before strategy retrieval
        strat_name, strat_instr, action_idx = supervisor.get_strategic_goal(fmu)
        print(f"\n🎰 BANDIT STRATEGY: {strat_name}")
        print(f"📝 Instruction: {strat_instr}")

        # 4. Research
        crop = fmu.metadata.get("crop", "unknown")
        stage = fmu.metadata.get("stage", "unknown")
        query = f"optimal hydroponic conditions for {crop} in {stage} stage"

        time.sleep(2) # Small delay before research
        research_context = researcher.search(query)
        
        # 5. 🟢 DELIBERATION (The Experts)
        # We pass the strategy instruction and history to the LangGraph agents
        print("\n🧠 Agents Planning...")
        
        # Updated call signature to match the new 'reason' method
        time.sleep(2) # Ensure research context is ready before reasoning
        atmos_plan = atmos_agent.reason(
            sensors=sensor_snapshot, 
            research=research_context, 
            strategy=strat_instr, # Pass the instruction text (e.g. "LOWER pH...")
            history=history,       # Pass history for context awareness
            image_b64=image_b64    # Pass the image data for visual diagnosis
        )

        print(f"\n🌬️ Atmospheric Plan:\n{atmos_plan}")

        time.sleep(2) # Small delay between agent calls
        
        water_plan = water_agent.reason(
            sensors=sensor_snapshot, 
            research=research_context, 
            strategy=strat_instr,
            history=history,
            image_b64=image_b64
        )

        print(f"\n💧 Water & Nutrient Plan:\n{water_plan}")

        # 6. Synthesis (The Supervisor)
        # Supervisor merges plans, checks conflicts, and ensures safety
        print("\n👮 Supervisor Finalizing...")
        final_action = supervisor.synthesize_plan(
            atmos_plan, 
            water_plan, 
            fmu, 
            history,
            strategy_info=(strat_name, strat_instr, action_idx)
        )

        print(f"🎯 FINAL COMMAND: {final_action}")

        # 7. Execute
        try:
            requests.post(SIMULATOR_ACTION_URL, json=final_action)
            print("✅ Sent to Simulator.")
        except Exception as e:
            print(f"❌ Connection Error: {e}")

        print("\nzzz Sleeping 15s...")
        time.sleep(15)

if __name__ == "__main__":
    main()