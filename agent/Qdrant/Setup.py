from qdrant_client import models
from Qdrant.Client import client  # <--- FIXED IMPORT

VECTOR_SIZE = 516
COLLECTION_NAME = "Farm_Memory"

# client = QdrantClient(url="http://localhost:6333")

client.recreate_collection(
    collection_name=COLLECTION_NAME,
    vectors_config=models.VectorParams(
        size=VECTOR_SIZE,
        distance=models.Distance.COSINE
    )
)

print("Collection created:", COLLECTION_NAME)