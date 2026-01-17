# tools/db_tools.py
from qdrant_client import QdrantClient, models
from qdrant_client.models import PointStruct

class DBTools:
    def __init__(self, host="https://2a9e6ab0-e572-4bfa-a50f-0a169f9753d3.europe-west3-0.gcp.cloud.qdrant.io", collection_name="farm_memory"):
        self.client = QdrantClient(url=host)
        self.collection_name = collection_name
        self.vector_size = 516 # As seen in Qdrant/Setup.py

    def setup_database(self):
        """Creates or resets the memory collection."""
        self.client.recreate_collection(
            collection_name=self.collection_name,
            vectors_config=models.VectorParams(
                size=self.vector_size,
                distance=models.Distance.COSINE
            )
        )
        print(f"[DB] Collection '{self.collection_name}' ready.")

    def store_fmu(self, fmu_data):
        """
        Stores a Farm Memory Unit (FMU).
        Derived from Qdrant/Store.py
        """
        point = PointStruct(
            id=fmu_data.id,
            vector=fmu_data.vector,
            payload=fmu_data.metadata
        )
        self.client.upsert(
            collection_name=self.collection_name,
            points=[point]
        )
        print(f"[DB] Stored FMU ID: {fmu_data.id}")

    def search_similar(self, vector, limit=5):
        """
        Finds similar past states.
        Derived from backend/server/main.py search endpoint
        """
        hits = self.client.search(
            collection_name=self.collection_name,
            query_vector=vector,
            limit=limit
        )
        return [{"score": hit.score, "payload": hit.payload} for hit in hits]