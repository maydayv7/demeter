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
        # FIX 1: Change .query() to .search()
        # FIX 2: Change top_k to limit (standard mem0 kwarg)
        results = farm_memory.memory.search(query, limit=3)
        
        # FIX 3: Format the output (mem0 returns a list/dict, we need a string)
        if isinstance(results, dict) and 'results' in results:
            data = results['results']
            return "\n".join([f"- {item.get('memory', str(item))}" for item in data])
            
        elif isinstance(results, list):
            return "\n".join([f"- {item.get('memory', str(item))}" for item in results])
            
        return str(results) if results else "No memory found."

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
        # --- FIX START ---
        # 1. Use the encoder directly from the researcher instance
        # 2. .embed() returns a generator, so we convert to list
        # 3. We take the first item [0] since we only embedded one query
        embeddings = list(researcher_instance.encoder.embed([query]))
        query_vector = embeddings[0].tolist() # Convert numpy array to list for Qdrant
        # --- FIX END ---
        
        hits = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=3
        )
        
        results = []
        for hit in hits:
            # Safely get payload data with defaults
            outcome = hit.payload.get('outcome', 'Unknown')
            action = hit.payload.get('action_taken', 'Unknown')
            results.append(f"Outcome: {outcome}\nAction: {action}\n---")
            
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
    

