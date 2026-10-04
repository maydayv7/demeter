import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient

# Load env from root
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, "..", "..", ".env")
load_dotenv(env_path)

client = QdrantClient(
    url=os.getenv("QDRANT_URL", "http://localhost:6333"),
    api_key=os.getenv("QDRANT_API_KEY"),
    timeout=60,
)

# print(client.get_collections())
