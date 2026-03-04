import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient

load_dotenv()

# 1. Connect to Qdrant directly
client = QdrantClient(
    url=os.getenv("QDRANT_URL"),
    api_key=os.getenv("QDRANT_API_KEY"),
)

collection_name = "plant_biographies"

# 2. Check and Delete
if client.collection_exists(collection_name):
    print(f"🗑️  Deleting mismatched collection: {collection_name}...")
    client.delete_collection(collection_name)
    print("✅ Collection deleted. Restart your main script now!")
else:
    print(f"⚠️  Collection {collection_name} not found. You are good to go.")