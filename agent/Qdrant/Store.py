from Qdrant.Client import client  # <--- FIXED IMPORT
from qdrant_client.models import PointStruct

COLLECTION_NAME = "Farm_Memory"

# client = QdrantClient(url="http://localhost:6333")

def store_fmu(fmu):
    point = PointStruct(
        id=fmu.id,
        vector=fmu.vector,
        payload=fmu.metadata
    )

    client.upsert(
        collection_name=COLLECTION_NAME,
        points=[point]
    )

    print("Stored FMU:", fmu.id)