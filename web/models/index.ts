// src/models/index.ts (or wherever your types are)

// 1. Keep SensorData and others as they are...
export interface SensorData {
  pH: string;
  EC: string;
  temp: string;
  humidity: string;
  crop: string;
  stage: string;
}

// 2. Add the new Decision Type
export interface AgentDecision {
  reasoning: string;
  action: string;
  confidence: number;
}

// 3. Update SearchResponse to match the new Backend output
export interface SearchResponse {
  status: string;
  // The backend now returns "search_results" instead of just "results"
  search_results: SearchResult[]; 
  // The new AI Brain output
  agent_decision?: AgentDecision; 
}

// 4. Ensure SearchResult matches what Qdrant sends
export interface SearchResult {
  id: string;
  score: number;
  payload: {
    crop: string;
    stage: string;
    timestamp?: string;
    sensors?: {
      pH: number;
      EC: number;
    };
    [key: string]: any; // Allow for other flexible fields
  };
}

export interface IngestResponse {
  status: "success" | "error";
  fmu_id?: string
  message?: string;
}