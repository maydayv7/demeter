import os
import json
from langchain.tools import tool
from qdrant_client import QdrantClient

# Import your existing modules
from agent.sub_agents.Researcher import ResearcherAgent
from agent.Qdrant.Store import COLLECTION_NAME

# Initialize shared clients
# Note: We rely on the existing ResearcherAgent logic for embeddings/search
researcher_instance = ResearcherAgent()

# Initialize Qdrant for the Historian
qdrant_client = QdrantClient(
    url=os.environ.get("QDRANT_URL", "http://localhost:6333"),
    api_key=os.environ.get("QDRANT_API_KEY"),
)

@tool
def ask_historian(query: str):
    """
    Search the Farm's Database (History) for similar past events.
    Useful for checking past mistakes, success rates, or specific scenarios.
    
    Args:
        query: A description of the situation to look up (e.g. "What happened when pH dropped to 5.5?")
    """
    try:
        # 1. We use the Researcher's internal embedder to vectorize the query
        # (Assuming ResearcherAgent has a method/property for this, or we use a fresh one)
        # If your ResearcherAgent doesn't expose it, we can fallback to a simple keyword search 
        # or instantiate a lightweight SentenceTransformer here.
        
        # For this example, we'll assume the Researcher can give us a vector:
        query_vector = researcher_instance.embed_query(query) 
        
        hits = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=3
        )
        
        results = []
        for hit in hits:
            payload = hit.payload
            results.append(f"Outcome: {payload.get('outcome')}\nAction: {payload.get('action_taken')}\n---")
            
        return "\n".join(results) if results else "No relevant history found."
        
    except Exception as e:
        return f"Historian unavailable: {str(e)}"

@tool
def ask_rag(query: str):
    """
    Consult the Research Assistant (RAG) for scientific knowledge.
    Useful for finding optimal ranges, chemical interactions, or biological facts.
    
    Args:
        query: Scientific question (e.g. "Optimal VPD for Lettuce in late flower")
    """
    try:
        # Reuse your existing ResearcherAgent logic
        return researcher_instance.search(query)
    except Exception as e:
        return f"Research unavailable: {str(e)}"