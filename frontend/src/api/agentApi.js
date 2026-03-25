import {
  USE_MOCK_DATA,
  MOCK_SEARCH_RESULT,
  MOCK_DASHBOARD,
} from "../data/mockData";

const API_URL = process.env.REACT_APP_AGENT_API_URL || "http://localhost:8000";

export const agentService = {
  /**
   * Uploads an image + sensors to create a new FMU (Functional Memory Unit)
   */
  async uploadFMU(file, sensors) {
    if (USE_MOCK_DATA) {
      await new Promise((r) => setTimeout(r, 500));
      return { status: "success", fmu_id: "mock-fmu-ingest-001" };
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "sensors",
      JSON.stringify({
        pH: parseFloat(sensors.pH),
        EC: parseFloat(sensors.EC),
        temp: parseFloat(sensors.temp),
        humidity: parseFloat(sensors.humidity),
        crop_id: sensors.crop_id || undefined,
      }),
    );
    formData.append(
      "metadata",
      JSON.stringify({
        crop: sensors.crop,
        stage: sensors.stage,
        crop_id: sensors.crop_id || undefined,
      }),
    );
    const res = await fetch(`${API_URL}/ingest`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  },

  /**
   * Searches for similar memories and gets an Agent Decision
   */
  async searchFMU(file, sensors) {
    if (USE_MOCK_DATA) {
      await new Promise((r) => setTimeout(r, 1200));
      return MOCK_SEARCH_RESULT;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "sensors",
      JSON.stringify({
        pH: parseFloat(sensors.pH),
        EC: parseFloat(sensors.EC),
        temp: parseFloat(sensors.temp),
        humidity: parseFloat(sensors.humidity),
        crop: sensors.crop,
        stage: sensors.stage,
        crop_id: sensors.crop_id || "",
      }),
    );
    const res = await fetch(`${API_URL}/search`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  },

  /**
   * Queries the RAG/Agent via Text
   * Returns: { status, results, query_logic }
   */
  async queryText(text) {
    if (USE_MOCK_DATA) {
      await new Promise((r) => setTimeout(r, 400));
      const q = text.toLowerCase();
      const filtered = MOCK_DASHBOARD.filter(
        (d) =>
          d.payload.crop?.toLowerCase().includes(q) ||
          d.payload.stage?.toLowerCase().includes(q) ||
          d.payload.crop_id?.toLowerCase().includes(q),
      );
      const results = filtered.length ? filtered : MOCK_DASHBOARD;
      return {
        status: "success",
        results: results.map((d) => ({
          id: d.id,
          score: Math.random() * 0.3 + 0.7,
          payload: d.payload,
        })),
        query_logic: {
          must: q ? [{ key: "crop", match: q }] : [],
        },
      };
    }

    const formData = new FormData();
    formData.append("query", text);
    const res = await fetch(`${API_URL}/query-text`, {
      method: "POST",
      body: formData,
    });
    return res.json();
  },

  /**
   * Queries the RAG/Agent via Audio
   */
  async queryAudio(audioBlob) {
    if (USE_MOCK_DATA) {
      await new Promise((r) => setTimeout(r, 800));
      return {
        status: "success",
        transcription: "show all lettuce crops",
        results: MOCK_DASHBOARD.filter((d) => d.payload.crop === "Lettuce").map(
          (d) => ({ id: d.id, score: 1, payload: d.payload }),
        ),
      };
    }

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    const res = await fetch(`${API_URL}/query-audio`, {
      method: "POST",
      body: formData,
    });
    return res.json();
  },
};
