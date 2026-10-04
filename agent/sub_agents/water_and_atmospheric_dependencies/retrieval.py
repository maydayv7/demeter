import os
import json
from langchain.tools import tool

# Import your existing modules
from agent.sub_agents.Researcher import ResearcherAgent
from agent.Qdrant.Store import COLLECTION_NAME

from agent.sub_agents.Doctor import VisionAgent
from agent.memory import FarmMemory

# Initialize shared clients
# Note: We rely on the existing ResearcherAgent logic for embeddings/search
researcher_instance = ResearcherAgent()
farm_memory = FarmMemory()

doctor = VisionAgent()

@tool
def diagnose_plant(image_b64: str = None):
    """
    Uses Computer Vision to scan the latest plant image for disease.
    
    INSTRUCTIONS FOR LLM: 
    Call this tool with NO arguments. The system will automatically 
    attach the latest camera feed for you.
    """
    if not image_b64:
        return {"error": "System Error: No visual data was injected into the tool call."}
        
    # Calls the analyze_frame method you updated earlier
    result = doctor.analyze_frame(image_b64)
    print(f"Diagnose Plant Result: {result}")
    return result

@tool
def ask_memory(plant_id: str):
    """
    Consult the Farm Memory for past events, strategies, and outcomes.
    Useful for recalling what has been tried before and its results.
    
    Args:
        plant_id: The specific crop ID to look up (e.g. "crop_beta").
    """
    print(f"Consulting Farm Memory for plant ID: {plant_id}")
    try:
        # Fixed: calling the wrapper method directly on the instance
        response = farm_memory.get_plant_history(plant_id)
        print(f"Memory response for {plant_id}: {response}")
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
        # Use Mem0's own search, not a hand-rolled embed+query. Plant_Biographies_HF
        # was indexed with FarmMemory's embedder (all-MiniLM-L6-v2) — embedding the
        # query with a *different* model (e.g. Researcher's bge-small-en-v1.5) would
        # silently return semantically meaningless "matches" despite matching
        # vector dimensions (both happen to be 384-dim).
        response = farm_memory.memory.search(query=query, limit=3)

        raw_results = response.get("results", response) if isinstance(response, dict) else response

        results = []
        for hit in raw_results or []:
            content = hit.get('memory', hit.get('text', ''))
            source = hit.get('user_id', hit.get('source', 'Unknown'))
            results.append(f"[{source}]: {content}")

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
    
