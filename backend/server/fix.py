import sys
import os
from dotenv import load_dotenv # Ensure you have python-dotenv installed

# 1. Get the folder where this script lives
current_dir = os.path.dirname(os.path.abspath(__file__))

# 2. Go up two levels to find the Project Root (Code/)
project_root = os.path.abspath(os.path.join(current_dir, '../../'))

# 3. Add Project Root to Python Path
sys.path.append(project_root)

# 4. 🔥 FORCE LOAD THE .ENV FILE 🔥
# This must happen BEFORE importing Qdrant.Client
env_path = os.path.join(project_root, '.env')
if os.path.exists(env_path):
    print(f"✅ Loading environment from: {env_path}")
    load_dotenv(env_path)
else:
    print("⚠️ WARNING: .env file not found at project root!")

# 5. NOW Import Client (It will see the loaded variables)
from Qdrant.Client import client
from qdrant_client.http import models

def create_indexes():
    print(f"🔧 Optimizing collection Farm_Memory...")
    
    # 1. Create Index for crop_id
    try:
        client.create_payload_index(
            collection_name="Farm_Memory",
            field_name="crop_id",
            field_schema=models.PayloadSchemaType.KEYWORD
        )
        print("✅ Index created for 'crop_id'")
    except Exception as e:
        print(f"ℹ️ Note on crop_id: {e}")

    # 2. Create Index for outcome
    try:
        client.create_payload_index(
            collection_name="Farm_Memory",
            field_name="outcome",
            field_schema=models.PayloadSchemaType.KEYWORD
        )
        print("✅ Index created for 'outcome'")
    except Exception as e:
        print(f"ℹ️ Note on outcome: {e}")

if __name__ == "__main__":
    create_indexes()