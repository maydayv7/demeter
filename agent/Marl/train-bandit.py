import sys
import os
import numpy as np
import random
import time

# 1. Setup Path to import sibling modules
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(parent_dir)

from agent.Marl.bandit import ContextualBandit
from agent.Marl.strategies import STRATEGIES, NUM_ACTIONS

def generate_scenario():
    """
    Generates DISTINCT scenarios with clear separations between strategies.
    Returns:
        context (np.array): 515-dim vector (512 visual + 3 sensors)
        sensors (dict): Sensor readings
        target_strategy (int): The index of the correct strategy
        scenario_name (str): Description for logging
    """
    scenario_type = random.randint(0, NUM_ACTIONS - 1)
    
    # Defaults - use float32 for consistency and speed
    vis_vec = np.zeros(512, dtype=np.float32)
    ph = random.uniform(5.8, 6.5)
    ec = random.uniform(1.2, 1.8)
    temp = random.uniform(22.0, 26.0)
    
    target_strategy = 0
    name = "Normal"

    # --- 0. MAINTAIN_CURRENT (FIX: Very obvious optimal conditions) ---
    if scenario_type == 0:
        ph = random.uniform(5.9, 6.3)      # Perfect pH
        ec = random.uniform(1.3, 1.7)      # Perfect EC
        temp = random.uniform(23.0, 25.0)  # Perfect temp
        # Minimal visual noise (healthy plant)
        vis_vec[0:5] = np.random.uniform(0.1, 0.3, 5)
        name = "Optimal Conditions"
        target_strategy = 0

    # --- 1. CALIBRATE_SENSORS (FIX: Physically impossible values) ---
    elif scenario_type == 1:
        choice = random.randint(0, 2)
        if choice == 0:
            ph = random.choice([-10.0, -5.0, 0.0, 15.0, 20.0, 50.0])
        elif choice == 1:
            ec = random.choice([-10.0, 0.0, 50.0, 100.0, 500.0])
        else:
            temp = random.choice([-50.0, -20.0, 100.0, 150.0, 500.0])
        
        # Strong visual anomaly signal
        vis_vec[0:20] = np.random.uniform(0.9, 1.0, 20)
        name = "Sensor Malfunction"
        target_strategy = 1

    # --- 2. AGGRESSIVE_PH_DOWN ---
    elif scenario_type == 2:
        ph = random.uniform(7.8, 12.0)  # Very alkaline
        name = "High pH (Alkaline)"
        target_strategy = 2
    
    # --- 3. AGGRESSIVE_PH_UP ---
    elif scenario_type == 3:
        ph = random.uniform(0.5, 4.2)  # Very acidic
        name = "Low pH (Acidic)"
        target_strategy = 3
        
    # --- 4. GENTLE_PH_BALANCING (FIX: Clear mild range) ---
    elif scenario_type == 4:
        if random.random() < 0.5:
            ph = random.uniform(5.4, 5.8)  # Slightly low
        else:
            ph = random.uniform(6.4, 6.9)  # Slightly high
        # Keep other sensors perfect
        ec = random.uniform(1.4, 1.6)
        temp = random.uniform(23.5, 24.5)
        name = "Mild pH Drift"
        target_strategy = 4

    # --- 5. INCREASE_EC_VEG ---
    elif scenario_type == 5:
        ec = random.uniform(0.1, 0.9)  # Low EC
        # Strong vegetative signal (first block)
        vis_vec[20:40] = np.random.uniform(0.6, 1.0, 20)
        name = "Low EC (Veg Stage)"
        target_strategy = 5
        
    # --- 6. INCREASE_EC_BLOOM ---
    elif scenario_type == 6:
        ec = random.uniform(0.1, 0.9)  # Low EC
        # Strong flowering signal (second block)
        vis_vec[40:60] = np.random.uniform(0.6, 1.0, 20)
        name = "Low EC (Bloom Stage)"
        target_strategy = 6
        
    # --- 7. LOWER_EC_FLUSH ---
    elif scenario_type == 7:
        ec = random.uniform(2.8, 8.0)  # Very high EC
        # Nutrient burn visual (third block)
        vis_vec[60:80] = np.random.uniform(0.7, 1.0, 20)
        name = "Nutrient Burn / High EC"
        target_strategy = 7
        
    # --- 8. CALMAG_BOOST ---
    elif scenario_type == 8:
        # CalMag deficiency visual pattern (fourth block)
        vis_vec[80:100] = np.random.uniform(0.8, 1.0, 20)
        name = "CalMag Deficiency (Visual)"
        target_strategy = 8

    # --- 9. RAISE_TEMP_HUMIDITY ---
    elif scenario_type == 9:
        temp = random.uniform(8.0, 17.0)  # Too cold
        name = "Too Cold / Low VPD"
        target_strategy = 9
        
    # --- 10. LOWER_TEMP_HUMIDITY ---
    elif scenario_type == 10:
        temp = random.uniform(32.0, 50.0)  # Too hot
        name = "Too Hot / High VPD"
        target_strategy = 10
        
    # --- 11. MAX_AIR_CIRCULATION ---
    elif scenario_type == 11:
        # Stagnant air visual (fifth block)
        vis_vec[100:120] = np.random.uniform(0.6, 1.0, 20)
        name = "Stagnant Air / Weak Stems"
        target_strategy = 11

    # --- 12. FUNGAL_TREATMENT ---
    elif scenario_type == 12:
        # Fungal infection visual (sixth block)
        vis_vec[120:140] = np.random.uniform(0.8, 1.0, 20)
        temp = random.uniform(26.0, 32.0)  # Warm and humid conditions
        name = "Fungal Infection Detected"
        target_strategy = 12
        
    # --- 13. PEST_ISOLATION ---
    elif scenario_type == 13:
        # Pest visual (seventh block)
        vis_vec[140:160] = np.random.uniform(0.8, 1.0, 20)
        name = "Pest Infestation Detected"
        target_strategy = 13
        
    # --- 14. PRUNE_NECROTIC_LEAVES ---
    elif scenario_type == 14:
        # Necrosis visual (eighth block)
        vis_vec[160:180] = np.random.uniform(0.8, 1.0, 20)
        name = "Necrosis Detected"
        target_strategy = 14

    # Build Final Context Vector
    sensor_vec = np.array([
        (ph - 6.0) / 2.0, 
        (ec - 1.0) / 3.0,
        (temp - 25.0) / 40.0
    ], dtype=np.float32)
    
    context = np.concatenate([vis_vec, sensor_vec])
    
    return context, {'pH': ph, 'EC': ec, 'temp': temp}, target_strategy, name

def train():
    print("=" * 80)
    print("🧠 CONTEXTUAL BANDIT TRAINING - HYDROPONIC CONTROL SYSTEM")
    print("=" * 80)
    print(f"   Strategy Count: {NUM_ACTIONS}")
    print(f"   Feature Dimensions: 515 (512 Vision + 3 Sensors)")
    print(f"   Training Episodes: 15,000")
    print()
    
    bandit = ContextualBandit(n_actions=NUM_ACTIONS, feature_dim=515)
    
    n_epochs = 15000
    correct_counts = np.zeros(NUM_ACTIONS, dtype=int)
    total_counts = np.zeros(NUM_ACTIONS, dtype=int)
    
    start_time = time.time()
    last_print_time = start_time
    
    for i in range(n_epochs):
        # 1. Generate scenario
        context, sensors, target_action, scenario_name = generate_scenario()
        
        # 2. Bandit prediction
        chosen_action_idx, debug_info = bandit.select_action(context)
        
        # 3. Calculate reward
        if chosen_action_idx == target_action:
            reward = 1.0
            correct_counts[target_action] += 1
        else:
            reward = -1.0
        
        total_counts[target_action] += 1
        
        # 4. Update bandit
        bandit.update(context, chosen_action_idx, reward)
        
        # Progress logging (every 2 seconds or every 1000 steps)
        current_time = time.time()
        if (i + 1) % 1000 == 0 or (current_time - last_print_time >= 2.0):
            elapsed = current_time - start_time
            speed = (i + 1) / elapsed
            eta = (n_epochs - i - 1) / speed if speed > 0 else 0
            current_acc = correct_counts.sum() / total_counts.sum() * 100 if total_counts.sum() > 0 else 0
            
            print(f"   [{i+1:5}/{n_epochs}] "
                  f"Accuracy: {current_acc:5.1f}% | "
                  f"Speed: {speed:4.0f} it/s | "
                  f"ETA: {eta:4.0f}s | "
                  f"Last: {scenario_name[:25]:<25}")
            last_print_time = current_time

    end_time = time.time()
    training_time = end_time - start_time
    
    print(f"\n✅ Training Complete in {training_time:.1f}s ({training_time/60:.1f} min)")
    print(f"   Average Speed: {n_epochs/training_time:.0f} iterations/second")
    
    # Detailed accuracy report
    print("\n" + "=" * 80)
    print("📊 FINAL ACCURACY REPORT BY STRATEGY")
    print("=" * 80)
    print(f"{'STRATEGY':<30} | {'ACCURACY':>10} | {'CORRECT':>8} / {'TOTAL':>8}")
    print("-" * 80)
    
    overall_correct = correct_counts.sum()
    overall_total = total_counts.sum()
    
    # Sort by accuracy (worst first) to highlight problems
    strategy_performance = []
    for idx in range(NUM_ACTIONS):
        count = total_counts[idx]
        correct = correct_counts[idx]
        acc = (correct / count) * 100 if count > 0 else 0.0
        strategy_performance.append((idx, acc, correct, count))
    
    strategy_performance.sort(key=lambda x: x[1])  # Sort by accuracy
    
    for idx, acc, correct, count in strategy_performance:
        status = "✅" if acc >= 90 else "⚠️" if acc >= 70 else "❌"
        print(f"{status} {STRATEGIES[idx]:<27} | {acc:>9.1f}% | {correct:>8} / {count:>8}")
        
    print("-" * 80)
    overall_acc = (overall_correct / overall_total) * 100
    print(f"{'OVERALL ACCURACY':<30} | {overall_acc:>9.1f}% | {overall_correct:>8} / {overall_total:>8}")
    print("=" * 80 + "\n")
    
    # Save model
    bandit.save()
    
    # Final recommendations
    if overall_acc >= 95:
        print("🎉 Excellent! Model ready for production.")
    elif overall_acc >= 90:
        print("✅ Good! Model is ready.")
    elif overall_acc >= 80:
        print("⚠️ Acceptable, but consider retraining with more epochs.")
    else:
        print("❌ Low accuracy. Check scenario generation or retrain.")

if __name__ == "__main__":
    train()