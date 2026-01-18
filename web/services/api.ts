import { SensorData, IngestResponse, SearchResponse } from "@/models";

const API_URL = "http://localhost:8000";

// Define the payload type here or import it from models
interface FeedbackPayload {
  fmu_id: string;
  action: string;
  outcome: string;
}

export const IngestService = {
  
  // 1. Upload Function (Existing)
  async uploadFMU(file: File, sensors: SensorData): Promise<IngestResponse> {
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

  // 2. Search Function (Existing)
  async searchFMU(file: File, sensors: SensorData): Promise<SearchResponse> {
    const formData = new FormData();
    formData.append("file", file);
    
    formData.append("sensors", JSON.stringify({
      pH: parseFloat(sensors.pH),
      EC: parseFloat(sensors.EC),
      temp: parseFloat(sensors.temp),
      humidity: parseFloat(sensors.humidity),
      crop: sensors.crop,
      stage: sensors.stage,
      crop_id: sensors.crop_id, // <--- Add this
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

  // 3. 👇 ADD THIS MISSING FUNCTION
  // async sendFeedback(data: FeedbackPayload) {
  //   try {
  //     const res = await fetch(`${API_URL}/feedback`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify(data),
  //     });
  //     if (!res.ok) throw new Error(`Server Error: ${res.statusText}`);
  //     return await res.json();
  //   } catch (error) {
  //     console.error("Feedback Error:", error);
  //     throw error;
  //   }
  // }
};