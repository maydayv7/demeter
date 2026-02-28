from qdrant_client import models
from Qdrant.Client import QdrantClient  # <--- FIXED IMPORT

VECTOR_SIZE = 516
COLLECTION_NAME = "farm_memory"

client = QdrantClient(url="http://localhost:6333")

client.recreate_collection(
    collection_name=COLLECTION_NAME,
    vectors_config=models.VectorParams(
        size=VECTOR_SIZE,
        distance=models.Distance.COSINE
    )
)

print("Collection created:", COLLECTION_NAME)