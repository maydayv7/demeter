import re
from pydantic import BaseModel
from typing import Dict, Any

# --- USER PROVIDED MODEL ---
class FarmAction(BaseModel):
    acid_dosage_ml: float = 0.0
    base_dosage_ml: float = 0.0
    nutrient_dosage_ml: float = 0.0
    fan_speed_pct: float = 0.0
    water_refill_l: float = 0.0

# --- CALIBRATION CONSTANTS ---
# How much does 1ml of solution change the reservoir?
# Assuming a ~50L reservoir for this simulation
RESERVOIR_LITERS = 50.0 
PH_STRENGTH = 0.02  # 1ml changes 50L by 0.02 pH
EC_STRENGTH = 0.05  # 1ml changes 50L by 0.05 EC

def _lookup_float(source: Dict[str, Any], key: str, default: float) -> float:
    """Case-insensitive field lookup coerced to float.

    Targets come straight out of LLM-generated JSON, so a field can arrive as a
    string ('6.0'), a range ('6.0-6.5'), or prose — dosing arithmetic on that
    raises TypeError and kills the whole cycle. Fall back to `default` instead.
    """
    val = next((v for k, v in source.items() if k.lower() == key.lower()), default)
    try:
        return float(val)
    except (TypeError, ValueError):
        pass
    # Salvage a leading number from strings like '6.0-6.5', '6.2 pH', '~24C'.
    match = re.search(r'-?\d+(?:\.\d+)?', str(val))
    return float(match.group()) if match else default


def convert_targets_to_actions(current_state: Dict[str, float], target_state: Dict[str, float]) -> FarmAction:
    """
    Acts as a Proportional Controller.
    Calculates the exact dosages/fan speeds needed to hit the targets.
    """
    action = FarmAction()

    print(f"Current State: {current_state}")
    print(f"Target State: {target_state}")
    
    # Extract common values
    current_temp = current_state.get('air_temp', 25)
    target_temp = target_state.get('air_temp', 25)
    current_rh = current_state.get('humidity', 60)
    target_rh = target_state.get('humidity', 60)
    current_light = current_state.get('light_intensity', 50)
    target_light = target_state.get('light_intensity', 50)
    
    # 1. pH CONTROL (Acid/Base)
    current_ph = next((v for k, v in current_state.items() if k.lower() == 'ph'), 6.0)
    target_ph = next((v for k, v in target_state.items() if k.lower() == 'ph'), 6.0)
    ph_error = target_ph - current_ph
    
    # Deadband: Don't dose if within 0.1
    if abs(ph_error) > 0.1:
        needed_change = abs(ph_error)
        # Formula: Dose = (Delta / Strength)
        dose = needed_change / PH_STRENGTH
        
        if ph_error < 0: 
            # Current is too high -> Need Acid
            action.acid_dosage_ml = round(dose, 2)
        else:
            # Current is too low -> Need Base
            action.base_dosage_ml = round(dose, 2)

    # 2. EC CONTROL (Nutrients/Water)
    current_ec = _lookup_float(current_state, 'ec', 6.0)
    target_ec = _lookup_float(target_state, 'ec', current_ec)
    ec_error = target_ec - current_ec
    
    # Track water needed for EC control
    water_for_dilution = 0.0
    
    if abs(ec_error) > 0.1:
        if ec_error > 0:
            # Current is too low -> Add Nutrients
            dose = ec_error / EC_STRENGTH
            action.nutrient_dosage_ml = round(dose, 2)
        else:
            # Current is too high -> Dilute with Water
            # Rough heuristic: Add 1L water to drop EC by ~0.1
            water_for_dilution = abs(ec_error) * 10

    # 3. TRANSPIRATION-BASED WATER REPLENISHMENT
    # Plants lose water continuously through transpiration based on environmental conditions
    # Base transpiration: 0.5 L/day for a typical hydroponic system
    # Increase with temperature, decrease with humidity, increase with light
    
    base_transpiration_per_4h = 0.5 / 6  # ~0.083 L per 4-hour cycle
    
    # Temperature effect: higher = more transpiration (optimal ~25C, max at 30C+)
    temp_factor = 1.0
    if target_temp > 25:
        temp_factor += (target_temp - 25) * 0.05  # +5% per degree above 25C
    elif target_temp < 20:
        temp_factor -= (20 - target_temp) * 0.02  # -2% per degree below 20C
    temp_factor = max(0.5, min(2.0, temp_factor))  # Clamp between 0.5 and 2.0
    
    # Humidity effect: lower humidity = more transpiration (inverse)
    humidity_factor = 1.0
    if target_rh < 50:
        humidity_factor += (50 - target_rh) * 0.01  # Drier = more transpiration
    elif target_rh > 80:
        humidity_factor -= (target_rh - 80) * 0.01  # Very humid = less transpiration
    humidity_factor = max(0.5, min(2.0, humidity_factor))
    
    # Light effect: more light = more photosynthesis = more transpiration
    light_factor = 1.0 + (target_light / 100.0) * 0.5  # 0% light = 1x, 100% light = 1.5x
    
    # Calculate total transpiration water needed
    transpiration_water = base_transpiration_per_4h * temp_factor * humidity_factor * light_factor
    transpiration_water = round(transpiration_water, 2)
    
    # 4. TOTAL WATER REFILL = Transpiration + Dilution
    action.water_refill_l = round(transpiration_water + water_for_dilution, 2)

    # 5. ATMOSPHERIC CONTROL (Fans)
    # Fans cool down air and lower humidity
    
    # Simple Logic: If too hot OR too humid, ramp up fans
    temp_error = current_temp - target_temp
    rh_error = current_rh - target_rh
    
    fan_speed = 0.0
    if temp_error > 0: fan_speed += temp_error * 10 # +1C = +10% speed
    if rh_error > 0: fan_speed += rh_error * 2      # +1% RH = +2% speed
    
    # Minimum circulation
    fan_speed = max(10.0, fan_speed)
    # Clamp to 100%
    action.fan_speed_pct = min(100.0, round(fan_speed, 1))

    return action