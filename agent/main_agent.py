import sys
import os
import requests
import time
from dotenv import load_dotenv

# Load env from root
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, "..", ".env")
load_dotenv(env_path)

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from sub_agents.fetching_agent import FetchingAgent
from sub_agents.judge_agent import JudgeAgent
from sub_agents.atmospheric_agent import AtmosphericAgent
from sub_agents.water_agent import WaterAgent
from sub_agents.Researcher import ResearcherAgent
from sub_agents.Supervisor import SupervisorAgent

SIMULATOR_ACTION_URL = os.getenv(
    "SIMULATOR_ACTION_URL", "http://localhost:8001/simulation/action"
)


def main():
    print("🚀 Initializing Demeter Orchestrator...")

    try:
        fetcher = FetchingAgent()
        judge = JudgeAgent()
        researcher = ResearcherAgent()
        atmos_agent = AtmosphericAgent()
        water_agent = WaterAgent()
        supervisor = SupervisorAgent(researcher_agent=researcher)
        print("✅ Agents Online.")
    except Exception as e:
        print(f"❌ Init Error: {e}")
        return

    while True:
        print("\n" + "=" * 50)
        print("⏱️  STARTING NEW CYCLE")
        print("=" * 50)

        crops_data = fetcher.fetch_and_process()
        if not crops_data:
            print("⚠️ No crops found. Waiting...")
            time.sleep(10)
            continue

        batch_actions = []

        for crop_data in crops_data:
            fmu = crop_data["fmu"]
            sensor_snapshot = crop_data["sensor_snapshot"]
            history = crop_data["history"]
            image_b64 = crop_data["image_b64"]
            crop_id = crop_data["crop_id"]

            print(f"\n🌱 --- PROCESSING CROP: {crop_id} ---")

            time.sleep(1)
            judge.review_previous_cycle(fmu, image_b64)

            time.sleep(1)
            strat_name, strat_instr, action_idx = supervisor.get_strategic_goal(fmu)
            print(f"\n🎰 BANDIT STRATEGY: {strat_name}")

            crop = fmu.metadata.get("crop", "unknown")
            stage = fmu.metadata.get("stage", "unknown")
            query = f"optimal hydroponic conditions for {crop} in {stage} stage"

            time.sleep(1)
            research_context = researcher.search(query)

            print("\n🧠 Agents Planning...")

            time.sleep(1)
            atmos_plan = atmos_agent.reason(
                sensors=sensor_snapshot,
                research=research_context,
                strategy=strat_instr,
                history=history,
                image_b64=image_b64,
            )

            time.sleep(1)
            water_plan = water_agent.reason(
                sensors=sensor_snapshot,
                research=research_context,
                strategy=strat_instr,
                history=history,
                image_b64=image_b64,
            )

            print("\n👮 Supervisor Finalizing...")
            final_action = supervisor.synthesize_plan(
                atmos_plan,
                water_plan,
                fmu,
                history,
                strategy_info=(strat_name, strat_instr, action_idx),
            )

            batch_actions.append({"crop_id": crop_id, "action": final_action})

            print(f"\n✅ Final Action for {crop_id}: {final_action}")
        try:
            requests.post(SIMULATOR_ACTION_URL, json=batch_actions)

            print(f"\n✅ Batch sent to Simulator ({len(batch_actions)} actions).")
        except Exception as e:
            print(f"\n❌ Connection Error: {e}")

        # print("\nzzz Sleeping 2 minutes...")
        # time.sleep(120)


if __name__ == "__main__":
    main()
