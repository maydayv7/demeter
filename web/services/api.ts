import { SensorData, IngestResponse, SearchResponse } from "@/models";

const API_URL = "http://localhost:8000";

export const IngestService = {
  // ... (keep uploadFMU as is) ...

  async uploadFMU(file: File, sensors: SensorData): Promise<IngestResponse> {
     // ... (your existing upload code) ...
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

  async searchFMU(file: File, sensors: SensorData): Promise<SearchResponse> {
    const formData = new FormData();
    formData.append("file", file);
    
    // We send sensor data because it's part of the vector math!
    formData.append("sensors", JSON.stringify({
      pH: parseFloat(sensors.pH),
      EC: parseFloat(sensors.EC),
      temp: parseFloat(sensors.temp),
      humidity: parseFloat(sensors.humidity)
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
  }
};