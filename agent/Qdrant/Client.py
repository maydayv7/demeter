from qdrant_client import QdrantClient

client = QdrantClient(
    url="https://2a9e6ab0-e572-4bfa-a50f-0a169f9753d3.europe-west3-0.gcp.cloud.qdrant.io:6333", 
    api_key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.RG2XaX6thvBqI6TCtUrFg8znHYbMuFGOvbxoxPgT020",
)

# print(qdrant_client.get_collections())