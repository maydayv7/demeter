from typing import List, TypedDict, Optional, Dict, Any
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    # Inputs
    sensors: Dict[str, float]
    strategy: str
    research_context: str
    history: str

    image_b64: Optional[str]
    
    # Internal Processing
    draft_plan: Optional[Dict[str, Any]]
    simulation_result: Optional[Dict[str, Any]]
    critique: Optional[str]
    retry_count: int

    messages: List[BaseMessage]
    
    # Final Output
    final_action: Optional[Dict[str, Any]]