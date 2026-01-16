export interface SensorData {
  pH: string;
  EC: string;
  temp: string;
  humidity: string;
  crop: string;
  stage: string;
}

export interface IngestResponse {
  status: "success" | "error";
  fmu_id?: string;
  message?: string;
}

// New Types for Search
export interface SearchResult {
  id: string;
  score: number;
  payload: {
    crop: string;
    stage: string;
    timestamp: string;
    sensors?: {
      pH: number;
      EC: number;
      temp: number;
      humidity: number;
    }
  };
}

export interface SearchResponse {
  results: SearchResult[];
  status?: string;
  message?: string;
}