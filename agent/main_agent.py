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
from sub_agents.Explainer import ExplainerAgent

SIMULATOR_ACTION_URL = os.getenv(
    "SIMULATOR_ACTION_URL", "http://localhost:8001/simulation/action"
)
FARM_API_URL = os.getenv("FARM_API_URL", "http://localhost:3001/api")


def sync_crop_metadata(crop_id, fields):
    """Push agent reasoning results (judge verdict, strategy, etc.) back to MongoDB
    so the frontend can display them. Best-effort: never blocks the cycle."""
    fields = {k: v for k, v in fields.items() if v is not None}
    if not fields:
        return
    try:
        requests.put(f"{FARM_API_URL}/crops/{crop_id}", json=fields, timeout=10)
    except Exception:
        pass


def main():
    print("🚀 Initializing Demeter Orchestrator...")

    try:
        fetcher = FetchingAgent()
        judge = JudgeAgent()
        researcher = ResearcherAgent()
        atmos_agent = AtmosphericAgent()
        water_agent = WaterAgent()
        supervisor = SupervisorAgent(researcher_agent=researcher)
        explainer = ExplainerAgent()
        print("✅ Agents Online.")
    except Exception:
        return

    while True:
        print("\n" + "=" * 50)
        print("⏱️  STARTING NEW CYCLE")
        print("=" * 50)

        crops_data = fetcher.fetch_and_process()
        if not crops_data:
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
            judge_result = judge.review_previous_cycle(fmu, image_b64)

            # Close the RL loop: feed the previous cycle's real outcome back into
            # the bandit so strategy selection actually improves over time,
            # instead of staying frozen at whatever model_bandit_greedy.pkl shipped with.
            training_data = judge_result.get("training_data")
            if training_data and training_data.get("prev_context_vector") is not None \
                    and training_data.get("prev_action_idx") is not None:
                try:
                    supervisor.bandit.update(
                        training_data["prev_context_vector"],
                        training_data["prev_action_idx"],
                        training_data["reward"],
                    )
                    supervisor.bandit.save()
                    print(f"   🎓 Bandit updated (action {training_data['prev_action_idx']}, reward {training_data['reward']})")
                except Exception:
                    pass
            # 🧠 BANDIT LEARNING: Update model based on previous cycle outcome
            if judge_result:
                supervisor.learn_from_outcome(fmu, judge_result)

            time.sleep(1)
            strat_name, strat_instr, action_idx = supervisor.get_strategic_goal(fmu)
            print(f"\n🎰 BANDIT STRATEGY: {strat_name}")

            sync_crop_metadata(crop_id, {
                "outcome": judge_result.get("outcome"),
                "reward_score": judge_result.get("reward"),
                "explanation_log": judge_result.get("explanation"),
                "visual_diagnosis": judge_result.get("visual_diagnosis"),
                "strategic_intent": strat_name,
                "bandit_action_id": action_idx,
            })

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

            print("\n📝 Explainer Generating Chain-of-Thought...")
            decision_explanation = explainer.explain(
                current_fmu={
                    "metadata": fmu.metadata,
                    "payload": {"sensors": sensor_snapshot},
                },
                similar_fmus=history,
                sub_agent_reports={"Atmospheric": atmos_plan, "Water": water_plan},
                final_decision=final_action,
            )
            sync_crop_metadata(crop_id, {"explanation_log": decision_explanation})
        try:
            requests.post(SIMULATOR_ACTION_URL, json=batch_actions)

            print(f"\n✅ Batch sent to Simulator ({len(batch_actions)} actions).")
        except Exception:
            pass

        # print("\nzzz Sleeping 2 minutes...")
        # time.sleep(120)


if __name__ == "__main__":
    main()
