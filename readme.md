# Demeter - Autonomous Hydroponic Intelligence

> _"The farm thinks for itself."_

Demeter is a fully autonomous, multi-agent AI system for precision hydroponic farm management.
It combines reinforcement learning, computer vision, LLM-based reasoning, vector memory, and a physics-based digital twin to monitor, analyze, and act on crop conditions - **24/7, without human intervention.**

Built for the **Microsoft AI Unlocked - AI for India** hackathon, Demeter addresses food security and precision agriculture challenges in the Indian context, with full Hindi language support and a design philosophy accessible to rural operators.

---

## Screenshots

![Landing Page](./assets/screenshots/landing_page.png)

---

## Key Features

### Multi-Agent System (MAS)

- **7 specialized AI agents** collaborating in a structured pipeline
- **Contextual Bandit (MARL)** for cycle-level strategic goal selection based on historical rewards
- **LangGraph state machines** for each expert agent with tool-use and retry loops
- **Supervisor Agent** that synthesizes conflicting expert plans and enforces safety constraints

### AI & Machine Learning

- **Azure OpenAI (GPT-4.1)** powering all LLM-based reasoning agents
- **Azure Custom Vision** for real-time plant disease and pest detection
- **CLIP (ViT-B/32)** for plant image encoding into the FMU vector
- **Custom Contextual Bandit** (LinGreedy) for strategic action selection
- **RAG pipeline** with FastEmbed + Qdrant for domain knowledge retrieval

### Memory & Storage

- **Qdrant Vector DB** - dual-collection architecture:
  - `Crop_States` - FMU snapshots (image + sensor fused vectors)
  - `Knowledge_Base` - agronomic research documents (RAG)
  - `Plant_Biographies_HF` - long-term per-crop memory (via Mem0)
- **Mem0** - semantic plant biography system backed by Azure OpenAI
- **Node.js + MongoDB** - structured crop metadata and event logs

### Physics Simulator

- **Digital Twin** with a hybrid physics + neural residual model
- Simulates pH, EC, water temp, air temp, humidity, VPD, and biomass
- Exposes REST API consumed by both the agent loop and frontend
- Syncs state to **Azure Digital Twins** after every action

---

## Tech Stack

| Layer                   | Technology                                           |
| ----------------------- | ---------------------------------------------------- |
| **LLM**                 | Azure OpenAI GPT-4.1                                 |
| **Agent Orchestration** | LangGraph, LangChain                                 |
| **Vision**              | Azure Custom Vision, CLIP ViT-B/32 (OpenAI)          |
| **Vector DB**           | Qdrant                                               |
| **Semantic Memory**     | Mem0                                                 |
| **Embeddings**          | FastEmbed (BAAI/bge-small-en-v1.5), all-MiniLM-L6-v2 |
| **Digital Twin**        | Azure Digital Twins + custom physics sim             |
| **Backend (Python)**    | FastAPI, Uvicorn                                     |
| **Backend (Node)**      | Express.js, MongoDB                                  |
| **Frontend**            | React 19, React Router v7, Recharts, Tailwind CSS v3 |
| **Physics**             | PyTorch (ResidualPhysicsNet), NumPy                  |
| **RL**                  | Custom Contextual Bandit (LinGreedy)                 |

---

## Architecture

![Architecture](./assets/architecture.png)

### The Farm Management Unit (FMU)

The FMU is the core data structure of Demeter.
It is a **fused multimodal vector** created by the Sentinel system at the start of every cycle:

```
Image (512×512 plant photo)
    ↓ CLIP ViT-B/32
    [512-dim visual embedding]
        +
Sensor Window (pH, EC, temp, humidity, VPD, biomass, ...)
    ↓ SensorEncoder (LSTM + linear projection)
    [7-dim sensor embedding]
        =
FMU Vector [519-dim]  ←→  stored in Qdrant with full metadata payload
```

The FMU is stored in Qdrant and becomes the **memory of the farm** - every past state is retrievable by similarity search.

---

### The 7-Agent Pipeline

Each autonomous cycle follows this sequence:

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEMETER AGENT CYCLE                         │
│                                                                 │
│  1. FetchingAgent                                               │
│     └─ Polls simulator/ADT → builds FMU → stores in Qdrant      │
│                                                                 │
│  2. JudgeAgent  (LangGraph)                                     │
│     └─ Retrieves N-1 FMU → runs Azure CV (visual forensics)     │
│     └─ Queries FarmMemory (Mem0) → deliberates via LLM          │
│     └─ Files reward score → trains Bandit                       │
│                                                                 │
│  3. SupervisorAgent → ContextualBandit                          │
│     └─ Encodes current FMU as context vector (519-dim)          │
│     └─ Bandit selects 1 of 15 strategies (LinGreedy)            │
│     └─ Strategy instruction passed to expert agents             │
│                                                                 │
│  4. ResearcherAgent                                             │
│     └─ Queries Knowledge_Base (RAG) for crop-specific data      │
│                                                                 │
│  5. AtmosphericAgent  (LangGraph)                               │
│     └─ Tools: ask_rag, web_search, calculate_vpd, diagnose_plant│
│     └─ Generates climate action plan (temp/humidity/CO2/light)  │
│     └─ Simulates plan → retry loop if unsafe                    │
│                                                                 │
│  6. WaterAgent  (LangGraph)                                     │
│     └─ Tools: ask_rag, web_search, calculate_vpd, diagnose_plant│
│     └─ Generates nutrient plan (pH dosing, EC adjustment)       │
│     └─ Simulates plan → retry loop if unsafe                    │
│                                                                 │
│  7. SupervisorAgent → synthesize_plan                           │
│     └─ Merges atmospheric + water plans                         │
│     └─ Detects conflicts, enforces safety bounds                │
│     └─ Dispatches final FarmAction to Simulator/ADT             │
└─────────────────────────────────────────────────────────────────┘
```

### The 15-Strategy MARL Bandit

The Contextual Bandit (`agent/Marl/bandit.py`) is a **LinGreedy** (pure-exploitation) contextual bandit that selects from 15 farm management strategies:

| Category     | Strategies                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------- |
| 🟢 Passive   | MAINTAIN_CURRENT, CALIBRATE_SENSORS                                                             |
| 💧 Nutrients | AGGRESSIVE_PH_DOWN/UP, GENTLE_PH_BALANCING, INCREASE_EC_VEG/BLOOM, LOWER_EC_FLUSH, CALMAG_BOOST |
| 🌤️ Climate   | RAISE_TEMP_HUMIDITY, LOWER_TEMP_HUMIDITY, MAX_AIR_CIRCULATION                                   |
| 🚑 Disease   | FUNGAL_TREATMENT, PEST_ISOLATION, PRUNE_NECROTIC_LEAVES                                         |

The bandit uses the **519-dim FMU vector as its context**, learns reward signals from the JudgeAgent, and persists its model weights to disk (`model_bandit_greedy.pkl`).

### The JudgeAgent - Closing the RL Loop

The JudgeAgent is the reward signal generator. After each cycle, it:

1. Retrieves the previous FMU (N-1) from Qdrant
2. Runs **Azure CV-based visual diagnosis** on the plant image
3. Queries **Mem0** for the crop's text biography
4. **Deliberates** via LLM: compares sensor delta, visual report, and history
5. Issues a reward score (−1.0 to +1.0) and outcome classification
6. **Updates Qdrant** payload and **writes to FarmMemory (Mem0)**
7. Returns training data → Bandit updates its weights online

### The Simulator - Physics + Neural Residual Digital Twin

The simulator (`simulator/main.py`) is a **FastAPI server** running a `DigitalTwin` class:

- **Hybrid physics model**: First-principles equations for pH, EC, VPD, biomass growth
- **Neural residual**: A small `ResidualPhysicsNet` (PyTorch MLP) that corrects physics approximations
- **State vector**: `[pH, EC, water_temp, air_temp, humidity, VPD, biomass]`
- **Image generation**: Outputs plant health images based on a bucket score (0–100)
- **Azure Digital Twins sync**: Every action call pushes telemetry to the ADT twin (`HydrophonicTank`)
- **Dual endpoints**: `/simulation/state` (agent loop) and `/azure/state` (ADT read-back)

---

## Frontend

The frontend is a highly responsive React 19 SPA featuring bilingual support (English/हिन्दी) for accessibility in Indian agriculture, made to serve as a Proof-of-Concept.

### Pages

| Page              | Route           | Description                                                                                        |
| ----------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| Landing Page      | `/`             | Hero, live agent activity feed, feature cards, live stats                                          |
| Dashboard         | `/dashboard`    | Crop card grid with health/maturity/stage filters and harvest banner                               |
| Crop Details      | `/crop/:id`     | Per-crop sensor charts, agent reasoning log, event timeline, actuator commands                     |
| Add Crop          | `/add-crop`     | Form to initialize a crop + live agent pipeline log with 6-phase progress tracker                  |
| Farm Intelligence | `/intelligence` | Natural-language RAG search against the agronomic knowledge base                                   |
| Analytics         | `/analytics`    | Multi-chart analytics: pH/EC/temp traces, daily sequences, parameter health scores, per-crop table |
| Alerts            | `/alerts`       | Categorized alert system (CRITICAL/WARNING/INFO/HARVEST) with acknowledge workflow                 |
| Help              | `/help`         | Farming terms, Simple explanations and definitions                                                 |
| Settings          | `/settings`     | Theme, language, farm name, notification prefs, onboarding                                         |

---

## Project Structure

```
demeter/
├── agent/
│   ├── main_agent.py            # Orchestration loop (runs the 7-agent cycle)
│   ├── memory.py                # FarmMemory class (Mem0 + Qdrant)
│   ├── Marl/
│   │   ├── bandit.py            # Contextual Bandit (LinGreedy, 15 arms)
│   │   ├── strategies.py        # Strategy definitions
│   │   └── train-bandit.py      # Offline training script
│   ├── Sentinel/
│   │   ├── agent.py             # FMUBuilder - creates fused vectors
│   │   ├── fmu.py               # FMU dataclass
│   │   └── Encoders/
│   │       ├── Vision.py        # CLIP ViT-B/32 image encoder
│   │       └── TimeSeries.py    # LSTM-based sensor encoder
│   ├── Qdrant/
│   │   ├── Client.py            # Qdrant client singleton
│   │   ├── Setup.py             # Collection initialization
│   │   ├── Store.py             # FMU storage helpers
│   │   └── Search.py            # Similarity search helpers
│   ├── sub_agents/
│   │   ├── base_agent.py        # BaseReasoningAgent (Azure OpenAI client)
│   │   ├── fetching_agent.py    # FetchingAgent - polls simulator, builds FMU
│   │   ├── judge_agent.py       # JudgeAgent - reward evaluation (LangGraph)
│   │   ├── atmospheric_agent.py # AtmosphericAgent - climate planning (LangGraph)
│   │   ├── water_agent.py       # WaterAgent - nutrient planning (LangGraph)
│   │   ├── Supervisor.py        # SupervisorAgent - strategy + synthesis
│   │   ├── Researcher.py        # ResearcherAgent - RAG knowledge retrieval
│   │   ├── Explainer.py         # ExplainerAgent - chain-of-thought log generation
│   │   ├── Doctor.py            # VisionAgent - plant disease detection (Azure Custom Vision)
│   │   └── water_and_atmospheric_dependencies/
│   │       ├── state.py         # LangGraph AgentState definition
│   │       ├── nodes.py         # LangGraph node functions
│   │       ├── tools.py         # LangChain tools (calculate_vpd, web_search)
│   │       ├── physics_engine.py# LLM-based plan safety simulator
│   │       └── retrieval.py     # LangChain tools (ask_rag, diagnose_plant, ask_memory)
│   └── tools/
│       ├── actuation.py         # Actuator command builders
│       ├── db_tools.py          # Database utility tools
│       ├── processing_tools.py  # Sensor processing utilities
│       └── reset_memory.py      # Memory reset utility
│
├── backend/
│   ├── server/
│   │   ├── main.py              # FastAPI server (Python) - agent HTTP endpoints
│   │   ├── functions.py         # Backend utility functions
│   │   ├── rag_brain.py         # PDF ingestion pipeline for Knowledge Base
│   │   ├── create-index.py      # Qdrant index setup script
│   │   └── reset-db.py          # Database reset utility
│   └── node_server/
│       ├── index.js             # Express.js server - crop CRUD API
│       ├── routes/farmRoutes.js # Farm route definitions
│       ├── controllers/         # Farm controller logic
│       └── config/db.js         # MongoDB connection
│
├── frontend/
│   ├── src/
│   │   ├── App.js               # Router, providers, onboarding gate
│   │   ├── pages/               # All 8 page components
│   │   ├── components/          # Sidebar, AgentWidgets, Onboarding
│   │   ├── hooks/               # useFarmData, useSettings, useTranslation
│   │   ├── api/                 # agentApi.js, farmApi.jsx
│   │   ├── utils/               # translations.js, dataUtils.js
│   │   └── data/mockData.js     # Mock data for testing
│   └── tailwind.config.js
│
├── simulator/
│   └── main.py                  # DigitalTwin + FastAPI server + Azure ADT sync
│
├── Knowledge_Base/              # Drop agronomic PDFs here for RAG ingestion
├── requirements.txt
└── README.md
```

---

## Setup & Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- A running [Qdrant](https://qdrant.tech/) instance (local Docker or Qdrant Cloud)
- Azure OpenAI resource with GPT-4.1 deployment
- (Optional) Azure Digital Twins instance

### 1. Clone & Install Python Dependencies

```bash
git clone https://github.com/maydayv7/demeter.git
cd demeter
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Azure OpenAI
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key   # Only needed for Qdrant Cloud

# Azure Custom Vision
AZURE_API_KEY=your_azure_api_key
AZURE_ENDPOINT=your_azure_endpoint
AZURE_PROJECT_ID=your_azure_project_id
AZURE_PREDICTION_KEY=your_azure_prediction_key
AZURE_URL=your_azure_url
AZURE_ITERATION_NAME=DemeterDoctor
DATASET_FOLDER="train"

# Simulator
SIMULATOR_STATE_URL=http://localhost:8001/simulation/state
SIMULATOR_ACTION_URL=http://localhost:8001/simulation/action
SIMULATOR_PORT=8001

# Azure Digital Twins
ADT_URL=your-adt-instance.digitaltwins.azure.net

# Frontend
REACT_APP_AGENT_API_URL=http://localhost:8000
REACT_APP_FARM_API_URL=http://localhost:3001/api
PORT=3001
```

### 3. Start Qdrant Database

**Option A: Local Docker (Recommended for development)**

```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

**Option B: Cloud Qdrant**

- Sign up at [cloud.qdrant.io](https://cloud.qdrant.io)
- Create a cluster and update your `.env` with the provided URL and API key

### 4. Initialize Database

Run the following command from the root directory to create the required collections and indexes:

```bash
python backend/server/create-index.py
```

### 5. Initialize the Knowledge Base (RAG)

Place agronomic PDFs in the `Knowledge_Base/` folder, then run:

```bash
python backend/server/rag_brain.py
```

Otherwise, download [model_bandit_greedy.pkl](https://drive.google.com/file/d/1spuw3TogZRtP0fYZkYA2Kxz1-CiUzBDA/view?usp=drive_link) and place it inside the `agent/Marl` directory.

### 6. Start the Simulator

```bash
cd simulator
python main.py
# Runs on http://localhost:8001
```

### 7. Start the Backend Servers

Download [plant_disease_model.pt](https://drive.google.com/file/d/1NkdGt0CFS7tx4vttp8Tod8ksjDLib8dp/view?usp=drive_link) and place it inside the `agent/model` directory.

```bash
# Python FastAPI server
cd backend/server
uvicorn main:app --reload --port 8000

# Node.js Express server
cd backend/node_server
npm install && npm start
```

### 8. Start the Frontend

```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3000
```

### 9. Run the Agent Loop

```bash
python agent/main_agent.py
```

---

**Made with ❤️ for the future of sustainable agriculture**
