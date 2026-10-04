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

    # Tool-call loop guards: how many tool-calling rounds have happened so far
    # (separate from retry_count, which only counts draft/simulate attempts),
    # and a name+args -> result cache so an identical call isn't re-invoked.
    tool_round_count: int
    tool_cache: Dict[str, str]

    messages: List[BaseMessage]
    
    # Final Output
    final_action: Optional[Dict[str, Any]]