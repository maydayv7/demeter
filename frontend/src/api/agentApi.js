// src/api/agentApi.js

const API_URL = "http://localhost:8000";

export const agentService = {
  /**
   * Uploads an image + sensors to create a new FMU (Functional Memory Unit)
   */
  async uploadFMU(file, sensors) {
     const formData = new FormData();
     formData.append("file", file);
     formData.append("sensors", JSON.stringify({
       pH: parseFloat(sensors.pH),
       EC: parseFloat(sensors.EC),
       temp: parseFloat(sensors.temp),
       humidity: parseFloat(sensors.humidity)
     }));
     formData.append("metadata", JSON.stringify({
       crop: sensors.crop,
       stage: sensors.stage
     }));
 
     try {
       const res = await fetch(`${API_URL}/ingest`, { method: "POST", body: formData });
       if (!res.ok) throw new Error(`Server Error: ${res.statusText}`);
       return await res.json();
     } catch (error) {
       console.error("Ingest Service Error:", error);
       throw error;
     }
  },

  /**
   * Searches for similar memories and gets an Agent Decision
   */
  async searchFMU(file, sensors) {
    const formData = new FormData();
    formData.append("file", file);
    
    formData.append("sensors", JSON.stringify({
      pH: parseFloat(sensors.pH),
      EC: parseFloat(sensors.EC),
      temp: parseFloat(sensors.temp),
      humidity: parseFloat(sensors.humidity),
      crop: sensors.crop,
      stage: sensors.stage,
      crop_id: sensors.crop_id || "", 
    }));

    try {
      const res = await fetch(`${API_URL}/search`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Server Error: ${res.statusText}`);
      return await res.json();
    } catch (error) {
      console.error("Search Service Error:", error);
      throw error;
    }
  },

  /**
   * Queries the RAG/Agent via Text
   */
  async queryText(text) {
    const formData = new FormData();
    formData.append("query", text);

    const res = await fetch(`${API_URL}/query-text`, {
        method: "POST",
        body: formData
    });
    return await res.json();
  },

  /**
   * Queries the RAG/Agent via Audio
   */
  async queryAudio(audioBlob) {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    const res = await fetch(`${API_URL}/query-audio`, {
        method: "POST",
        body: formData
    });
    return await res.json();
  }
};