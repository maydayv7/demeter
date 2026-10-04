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

    # 1. pH CONTROL (Acid/Base)
    current_ph = _lookup_float(current_state, 'ph', 6.0)
    target_ph = _lookup_float(target_state, 'ph', current_ph)
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
    
    if abs(ec_error) > 0.1:
        if ec_error > 0:
            # Current is too low -> Add Nutrients
            dose = ec_error / EC_STRENGTH
            action.nutrient_dosage_ml = round(dose, 2)
        else:
            # Current is too high -> Dilute with Water
            # Rough heuristic: Add 1L water to drop EC by ~0.1
            dilution_needed = abs(ec_error) * 10 
            action.water_refill_l = round(dilution_needed, 2)

    # 3. ATMOSPHERIC CONTROL (Fans)
    # Fans cool down air and lower humidity
    current_temp = _lookup_float(current_state, 'air_temp', 25)
    target_temp = _lookup_float(target_state, 'air_temp', current_temp)
    current_rh = _lookup_float(current_state, 'humidity', 60)
    target_rh = _lookup_float(target_state, 'humidity', current_rh)
    
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