# agent/Marl/strategies.py

STRATEGIES = {
    # --- 🟢 GLOBAL / PASSIVE ---
    0: "MAINTAIN_CURRENT",       # Everything looks good, hold steady.
    1: "CALIBRATE_SENSORS",      # Data looks weird/impossible (e.g., pH 0). Check hardware.
    
    # --- 💧 NUTRIENT INTERVENTIONS ---
    2: "AGGRESSIVE_PH_DOWN",     # pH is way too high (> 7.5).
    3: "AGGRESSIVE_PH_UP",       # pH is way too low (< 4.5).
    4: "GENTLE_PH_BALANCING",    # pH is slightly off, use mild correction.
    5: "INCREASE_EC_VEG",        # Plants are hungry (Vegetative Nitrogen boost).
    6: "INCREASE_EC_BLOOM",      # Plants are hungry (Flowering PK boost).
    7: "LOWER_EC_FLUSH",         # Nutrient burn detected (Tips yellowing). Reduce EC.
    8: "CALMAG_BOOST",           # Specific deficiency (Magnesium/Calcium).
    
    # --- 🌤️ CLIMATE INTERVENTIONS ---
    9: "RAISE_TEMP_HUMIDITY",    # "VPD Low" protocol.
    10: "LOWER_TEMP_HUMIDITY",   # "VPD High" / Mold risk protocol.
    11: "MAX_AIR_CIRCULATION",   # Stagnant air / weak stems.
    
    # --- 🚑 DISEASE / BIO ---
    12: "FUNGAL_TREATMENT",      # White powdery spots detected.
    13: "PEST_ISOLATION",        # Bugs visible.
    14: "PRUNE_NECROTIC_LEAVES"  # Remove dead plant matter to prevent spread.
}

NUM_ACTIONS = len(STRATEGIES)