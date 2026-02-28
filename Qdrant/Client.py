from qdrant_client import QdrantClient

def get_client():
    return QdrantClient(
        url="http://localhost:6333"  # change if using cloud
        # api_key="YOUR_API_KEY"
    )
