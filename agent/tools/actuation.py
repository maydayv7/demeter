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

def convert_targets_to_actions(current_state: Dict[str, float], target_state: Dict[str, float]) -> FarmAction:
    """
    Acts as a Proportional Controller.
    Calculates the exact dosages/fan speeds needed to hit the targets.
    """
    action = FarmAction()
    
    # 1. pH CONTROL (Acid/Base)
    current_ph = current_state.get('ph', 6.0)
    target_ph = target_state.get('ph', 6.0)
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
    current_ec = current_state.get('ec', 1.5)
    target_ec = target_state.get('ec', 1.5)
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
    current_temp = current_state.get('air_temp', 25)
    target_temp = target_state.get('air_temp', 25)
    current_rh = current_state.get('humidity', 60)
    target_rh = target_state.get('humidity', 60)
    
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