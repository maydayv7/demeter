# 🛠️ Demeter System Setup Guide

This guide covers the complete installation, configuration, and troubleshooting process for the **Demeter** Autonomous Hydroponic System.

---

## 📋 Prerequisites

Ensure you have the following installed on your machine:

1.  **Python 3.10+**: [Download Here](https://www.python.org/downloads/)
2.  **Node.js 16+ & npm**: [Download Here](https://nodejs.org/)
3.  **Docker Desktop** (Recommended for local Database) OR a [Qdrant Cloud Account](https://cloud.qdrant.io/).
4.  **Git**: [Download Here](https://git-scm.com/)

---

## 1️⃣ Environment Configuration

1.  Navigate to the project root directory.
2.  Create a file named `.env`.
3.  Add the following keys. You **must** provide a Groq API Key.

```env
# --- AI Provider (Required) ---
# Get a free key at: [https://console.groq.com/keys](https://console.groq.com/keys)
GROQ_API_KEY=gsk_...

# --- Vector Database (Required) ---
# For Local Docker: http://localhost:6333
# For Cloud: [https://xyz-example.us-east-1-0.aws.cloud.qdrant.io:6333](https://xyz-example.us-east-1-0.aws.cloud.qdrant.io:6333)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# --- Optional / Advanced ---
# Required if you switch 'FarmMemory' to use OpenAI embeddings instead of local ONNX
OPENAI_API_KEY=sk-...

# Required for 'Researcher' agent to perform live Google searches
SERPAPI_API_KEY=...