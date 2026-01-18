import sys
import os
# --- PATH FIX: Add project root to system path ---
# This ensures Python can see 'agent', 'Qdrant', 'Sentinel' from anywhere
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../'))
sys.path.append(project_root)
# -------------------------------------------------

from agent.sub_agents.Researcher import ResearcherAgent
from agent.sub_agents.Supervisor import SupervisorAgent

# 1. Setup Agents
print("🌱 Waking up Agents...")
researcher = ResearcherAgent()
supervisor = SupervisorAgent(researcher)

# 2. Seed some dummy knowledge (Run this once)
print("📚 Ingesting Knowledge...")
researcher.ingest_text(
    "Lettuce in vegetative stage requires pH between 5.5 and 6.5. "
    "Yellowing leaves often indicate Nitrogen deficiency or low pH lockout."
)

# 3. Mock Data (Simulate what the Backend would send)
mock_fmu = {
    "metadata": {"crop": "Lettuce", "stage": "Vegetative"},
    "payload": {"sensors": {"pH": 4.2, "EC": 1.2}}
}
mock_similar_fmus = [
    {"score": 0.88, "payload": {"outcome": "Recovered after adding pH Up"}}
]
mock_sub_agents = {
    "nutrient_analysis": "Critical Low pH detected.",
    "resource_status": "Water tank at 15%."
}

# 4. Run Reasoning
print("🧠 Supervisor is thinking...")
decision = supervisor.reason(mock_fmu, mock_similar_fmus, mock_sub_agents)

print("\n=== FINAL DECISION ===")
print(decision)