import sys
import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http import models

# --- CONFIGURATION ---
COLLECTION_NAME = "Farm_Memory"
VECTOR_SIZE = 516  # 512 (Vision) + 4 (Sensors: pH, EC, Temp, Humid)

# 1. Load Environment Variables
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../')) 
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

# 2. Connect to Qdrant (Handles Cloud or Local)
qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
qdrant_key = os.getenv("QDRANT_API_KEY", None)

print(f"🔌 Connecting to Qdrant at: {qdrant_url}...")
client = QdrantClient(url=qdrant_url, api_key=qdrant_key)

def reset_db():
    # 3. Check if Collection Exists and Delete it
    if client.collection_exists(COLLECTION_NAME):
        print(f"🔥 Deleting existing collection '{COLLECTION_NAME}'...")
        client.delete_collection(COLLECTION_NAME)
        print("✅ Deleted.")
    else:
        print(f"⚠️ Collection '{COLLECTION_NAME}' did not exist.")

    # 4. Create the New Collection
    print(f"🛠️ Creating collection '{COLLECTION_NAME}' with {VECTOR_SIZE} dimensions...")
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=models.VectorParams(
            size=VECTOR_SIZE,
            distance=models.Distance.COSINE
        )
    )
    print("✅ Collection created.")

    # 5. Create Payload Indexes (CRITICAL STEP)
    print("🏗️ Creating Payload Indexes...")

    # A. Text Fields (Keyword)
    text_indexes = [
        "crop",         # "Lettuce"
        "stage",        # "Vegetative"
        "crop_id",      # "Batch_A1"
        "outcome",      # "Negative"
        "action_taken"  # "Add CalMag"
    ]

    for field in text_indexes:
        try:
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name=field,
                field_schema=models.PayloadSchemaType.KEYWORD
            )
            print(f"   👉 Indexed (Keyword): '{field}'")
        except Exception as e:
            print(f"   ⚠️ Error indexing '{field}': {e}")

    # B. Numeric Fields (Integer)
    # 👇 NEW: Index sequence_number so we can sort by it later
    try:
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="sequence_number",
            field_schema=models.PayloadSchemaType.INTEGER
        )
        print(f"   👉 Indexed (Integer): 'sequence_number'")
    except Exception as e:
        print(f"   ⚠️ Error indexing 'sequence_number': {e}")

    print("\n🎉 Database Reset Complete! You are ready to ingest data.")

if __name__ == "__main__":
    reset_db()