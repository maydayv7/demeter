# agent/Marl/Bandit.py

import numpy as np
import pickle
import os

class ContextualBandit:
    def __init__(self, n_actions=15, feature_dim=515):
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
        
        # theta: Weight vectors for each action (optional, computed on-the-fly)
        self.theta = [np.zeros(self.d) for _ in range(self.n_actions)]
        
        self.file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_bandit_greedy.pkl")
        self.load()  # Now calls with no arguments

    def select_action(self, context_vector):
        """
        Returns: (action_index, debug_info)
        Strictly picks the action with the highest PREDICTED reward.
        """
        # Ensure context is flat (1D array)
        context_vector = np.array(context_vector).reshape(-1)
        
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
            try:
                variance = context_vector.dot(np.linalg.solve(self.A[a], context_vector))
                confidences[a] = 1.0 / (1.0 + variance) # Simple confidence score (0-1)
            except np.linalg.LinAlgError:
                confidences[a] = 0.0

        # 🟢 PURE EXPLOITATION: Pick max predicted reward
        chosen_action = np.argmax(predicted_rewards)
        
        return chosen_action, {
            "scores": predicted_rewards.tolist(), 
            "confidences": confidences.tolist()
        }

    def update(self, context_vector, action_idx, reward):
        """
        Online Learning: The AI still gets smarter with every feedback.
        
        Args:
            context_vector: The feature vector (515-dim)
            action_idx: Which action was taken
            reward: The reward received
        """
        # Ensure types are correct
        action_idx = int(action_idx)
        reward = float(reward)
        
        # Ensure context is flat (1D array)
        context_vector = np.array(context_vector).reshape(-1)
        
        # Update the regression model for the chosen arm
        self.A[action_idx] += np.outer(context_vector, context_vector)
        self.b[action_idx] += reward * context_vector
        
        # Update theta (optional, can be computed on-the-fly in select_action)
        try:
            self.theta[action_idx] = np.linalg.solve(self.A[action_idx], self.b[action_idx])
        except np.linalg.LinAlgError:
            # Use pseudoinverse if solve fails
            self.theta[action_idx] = np.linalg.pinv(self.A[action_idx]).dot(self.b[action_idx])

    def save(self):
        """Save the model weights to disk"""
        try:
            with open(self.file_path, 'wb') as f:
                pickle.dump({
                    'A': self.A, 
                    'b': self.b,
                    'theta': self.theta
                }, f)
            print(f"💾 Model saved to {self.file_path}")
        except Exception as e:
            print(f"❌ Error saving model: {e}")

    def load(self):  # <--- FIXED: No filepath argument, uses self.file_path
        """Loads weights from disk if they exist."""
        if not os.path.exists(self.file_path):
            print(f"ℹ️ No saved model found at {self.file_path}. Starting fresh.")
            return False
            
        try:
            with open(self.file_path, 'rb') as f:
                state = pickle.load(f)
            
            # Restore state
            self.A = state['A']
            self.b = state['b']
            self.theta = state['theta']
            print(f"✅ Loaded bandit model from {self.file_path}")
            return True
        except Exception as e:
            print(f"⚠️ Error loading model: {e}. Starting fresh.")
            return False