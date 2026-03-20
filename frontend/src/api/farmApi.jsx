import { USE_MOCK_DATA, MOCK_DASHBOARD, MOCK_HISTORY } from "../data/mockData";

const API_BASE_URL = "http://localhost:3001/api";

/**
 * Fetches the latest state of all unique crops for the Dashboard.
 */
export const fetchDashboardData = async () => {
  if (USE_MOCK_DATA) {
    await new Promise((r) => setTimeout(r, 300)); // simulate latency
    return MOCK_DASHBOARD;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/dashboard`);
    if (!res.ok) throw new Error("Network error");
    return res.json();
  } catch {
    return [];
  }
};

/**
 * Fetches the full history (logs, charts) for a specific crop ID.
 */
export const fetchCropDetails = async (cropId) => {
  if (USE_MOCK_DATA) {
    await new Promise((r) => setTimeout(r, 200));
    return MOCK_HISTORY.filter((h) => h.payload?.crop_id === cropId);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/crop/${cropId}`);
    if (!res.ok) throw new Error("Network error");
    return res.json();
  } catch {
    return [];
  }
};

/**
 * Fetches full history for every crop present in the dashboard snapshot.
 * Returns a flat array of all point objects sorted oldest → newest by timestamp.
 */
export const fetchAllCropHistories = async (dashboardItems) => {
  if (USE_MOCK_DATA) {
    await new Promise((r) => setTimeout(r, 200));
    return MOCK_HISTORY.sort((a, b) => {
      const ta = new Date(a.payload?.timestamp || 0).getTime();
      const tb = new Date(b.payload?.timestamp || 0).getTime();
      return ta - tb;
    });
  }

  if (!dashboardItems?.length) return [];
  const cropIds = [
    ...new Set(dashboardItems.map((i) => i.payload?.crop_id).filter(Boolean)),
  ];
  const results = await Promise.allSettled(
    cropIds.map((id) =>
      fetch(`${API_BASE_URL}/crop/${id}`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ),
  );
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return all.sort((a, b) => {
    const ta = new Date(a.payload?.timestamp || 0).getTime();
    const tb = new Date(b.payload?.timestamp || 0).getTime();
    return ta - tb;
  });
};
