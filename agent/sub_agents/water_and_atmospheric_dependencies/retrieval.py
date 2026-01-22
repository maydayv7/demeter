import os
import json
from langchain.tools import tool
from qdrant_client import QdrantClient

# Import your existing modules
from agent.sub_agents.Researcher import ResearcherAgent
from agent.Qdrant.Store import COLLECTION_NAME

from agent.sub_agents.Doctor import VisionAgent
from agent.memory import FarmMemory

# Initialize shared clients
# Note: We rely on the existing ResearcherAgent logic for embeddings/search
researcher_instance = ResearcherAgent()
farm_memory = FarmMemory()

# Initialize Qdrant for the Historian
qdrant_client = QdrantClient(
    url=os.environ.get("QDRANT_URL", "http://localhost:6333"),
    api_key=os.environ.get("QDRANT_API_KEY"),
)

doctor = VisionAgent()

@tool
def diagnose_plant(image_path: str):
    """
    Uses Computer Vision to scan the plant image for disease, pests, or growth issues.
    Call this if you suspect the plant is sick or need to verify visual health.
    
    Args:
        image_path (str): The absolute file path of the image (provided in your instructions/context).
        
    Returns:
        JSON report containing 'health_assessment' and 'object_counts'.
    """
    if not image_path or image_path == "None":
        return {"error": "No image path provided."}
        
    return doctor.analyze_frame(image_path)

@tool
def ask_memory(query: str):
    """
    Consult the Farm Memory for past events, strategies, and outcomes.
    Useful for recalling what has been tried before and its results.
    
    Args:
        query: A description of the situation to look up (e.g. "What strategies were used when humidity was high?")
    """
    try:
        response = farm_memory.memory.query(query, top_k=3)
        return response
    except Exception as e:
        return f"Memory unavailable: {str(e)}"

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
    

