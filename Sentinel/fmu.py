# fmu.py
from dataclasses import dataclass
from typing import Dict, Any, List

@dataclass
class FMU:
    id: str
    vector: List[float]
    metadata: Dict[str, Any]
