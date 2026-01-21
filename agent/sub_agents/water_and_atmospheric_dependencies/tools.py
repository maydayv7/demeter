from langchain.tools import tool
import math

@tool
def calculate_vpd(air_temp_c: float, humidity: float) -> float:
    """Calculates Vapor Pressure Deficit (kPa). Target: 0.8-1.2 kPa."""
    svp = 0.6108 * math.exp((17.27 * air_temp_c) / (air_temp_c + 237.3))
    avp = svp * (humidity / 100.0)
    return round(svp - avp, 2)

@tool
def check_ph_safety(current_ph: float, proposed_change: float) -> str:
    """Checks if a pH swing is too aggressive (>0.5 change)."""
    predicted_ph = current_ph + proposed_change
    swing = abs(predicted_ph - current_ph)
    if swing > 0.5:
        return f"DANGER: pH swing of {swing} is too high. Max safe swing is 0.5."
    if predicted_ph < 5.0 or predicted_ph > 7.0:
        return f"WARNING: Target pH {predicted_ph} is out of safe range (5.5-6.5)."
    return "SAFE"

# Placeholder for your Web Search (Tavily/Serper)
@tool
def web_search(query: str) -> str:
    """Searches the web for specific hydroponic thresholds."""
    # Implement your search logic here (or use LangChain's TavilySearchResults)
    return f"Simulated search result for: {query}"