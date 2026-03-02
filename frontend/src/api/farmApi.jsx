// src/api/farmApi.js

const API_BASE_URL = 'http://localhost:3001/api';

/**
 * Fetches the latest state of all unique crops for the Dashboard.
 */
export const fetchDashboardData = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    return []; // Return empty array on failure
  }
};

/**
 * Fetches the full history (logs, charts) for a specific crop ID.
 */
export const fetchCropDetails = async (cropId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/crop/${cropId}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch details for ${cropId}:`, error);
    return [];
  }
};