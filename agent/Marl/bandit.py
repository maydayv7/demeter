# agent/Marl/Bandit.py

import numpy as np
import pickle
import os

class ContextualBandit:
    def __init__(self, n_actions=15, feature_dim=519):
        """
        LinGreedy Implementation (Pure Exploitation).
        We removed 'alpha' because we do not want to explore.
        """
        self.n_actions = n_actions
        self.d = feature_dim
        
        # A: Covariance Matrix (Used for Ridge Regression learning)
        self.A = [np.identity(self.d) for _ in range(self.n_actions)]
        
        # b: Reward Vector
        self.b = [np.zeros(self.d) for _ in range(self.n_actions)]
        
        self.file_path = "model_bandit_greedy.pkl"
        self.load()

    def select_action(self, context_vector):
        """
        Returns: (action_index, debug_info)
        Strictly picks the action with the highest PREDICTED reward.
        """
        predicted_rewards = np.zeros(self.n_actions)
        confidences = np.zeros(self.n_actions)
        
        for a in range(self.n_actions):
            # 1. Calculate Mean Estimate (theta)
            # theta = A^-1 * b
            try:
                theta = np.linalg.solve(self.A[a], self.b[a])
            except np.linalg.LinAlgError:
                # Fallback for singular matrix (rare with Identity init)
                theta = np.zeros(self.d)
            
            # 2. Expected Reward (Dot Product)
            # This is the "Best Guess" for how good this action is.
            pred = theta.dot(context_vector)
            predicted_rewards[a] = pred
            
            # 3. Calculate Confidence (Optional, for UI only)
            # We calculate variance just to show the user "How sure are we?"
            # But we do NOT add this to the score.
            variance = context_vector.dot(np.linalg.solve(self.A[a], context_vector))
            confidences[a] = 1.0 / (1.0 + variance) # Simple confidence score (0-1)

        # 🟢 PURE EXPLOITATION: Pick max predicted reward
        chosen_action = np.argmax(predicted_rewards)
        
        return chosen_action, {
            "scores": predicted_rewards.tolist(), 
            "confidences": confidences.tolist()
        }
    
    random_context = np.random.rand(519).astype(np.float32)    

    def update(self, action_idx, context_vector=random_context, reward="0.0"):
        """
        Online Learning: The AI still gets smarter with every feedback.
        """
        # Update the regression model for the chosen arm
        self.A[action_idx] += np.outer(context_vector, context_vector)
        self.b[action_idx] += reward * context_vector
        
        self.save()
        print(f"📈 Greedy Model Updated | Action: {action_idx} | Reward: {reward}")

    def save(self):
        with open(self.file_path, 'wb') as f:
            pickle.dump({'A': self.A, 'b': self.b}, f)

    def load(self):
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, 'rb') as f:
                    data = pickle.load(f)
                    self.A = data['A']
                    self.b = data['b']
            except Exception:
                print("⚠️ Could not load model, starting fresh.")