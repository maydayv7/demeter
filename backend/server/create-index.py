"""
Script to create payload indexes for filtering in Qdrant.
Run this ONCE to enable filtering by 'crop' and 'stage'.
"""

import sys
import os

# Add project root to path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../'))
sys.path.append(project_root)

from Qdrant.Client import client
from Qdrant.Store import COLLECTION_NAME
from qdrant_client.http import models

def create_indexes():
    """Create keyword indexes for crop and stage fields"""
    
    print(f"📑 Creating payload indexes for collection: {COLLECTION_NAME}")
    
    try:
        # Create index for 'crop' field
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="crop",
            field_schema=models.PayloadSchemaType.KEYWORD
        )
        print("✅ Index created for 'crop' field")
        
        # Create index for 'stage' field
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="stage",
            field_schema=models.PayloadSchemaType.KEYWORD
        )
        print("✅ Index created for 'stage' field")
        
        print("\n🎉 All indexes created successfully!")
        print("You can now use filtered searches in your /search endpoint.")
        
    except Exception as e:
        print(f"❌ Error creating indexes: {e}")
        print("\nNote: If indexes already exist, this is normal.")

if __name__ == "__main__":
    create_indexes()