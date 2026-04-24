export type FarmStatus = 'drought' | 'healthy' | 'unknown';

export interface Farm {
  farmId: string;
  farmerName: string;
  coordinates: { lat: number; lng: number };
  polygon: [number, number][];
  areaSqKm: number;
  cropType: string;
  walletAddress: string;
}

export interface ProofOfLoss {
  avg_ndvi: number;
  avg_rainfall_mm: number;
  min_ndvi: number;
  max_rainfall_mm: number;
  days_evaluated: number;
  ndvi_threshold: number;
  rainfall_threshold_mm: number;
  observation_window: { start: string; end: string };
  data_source: string;
}

export interface DroughtEvaluation {
  triggered: boolean;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  proof_of_loss: ProofOfLoss;
}

export type DataSource = 'real' | 'hybrid' | 'mock' | 'sentinel-2' | 'simulated';
export type NdviSource = 'mock' | 'sentinel-2';
export type RainfallSource = 'mock' | 'open-meteo';

export interface NdviScene {
  sceneId: string | null;
  sceneDate: string;
  cloud: number;
}

export interface DailyObservation {
  farmId: string;
  observation_date: string;
  ndvi: number;
  rainfall_mm: number;
  soil_moisture?: number;
  ndvi_source: NdviSource;
  rainfall_source: RainfallSource;
  source: DataSource;
  ndvi_scene?: NdviScene | null;
}

export interface ProvenanceSummary {
  ndvi_real_days: number;
  rainfall_real_days: number;
  total_days: number;
}

export interface FarmStatusResponse {
  farmId: string;
  farmerName: string;
  cropType: string;
  areaSqKm: number;
  coordinates: { lat: number; lng: number };
  walletAddress: string;
  ndvi: number;
  rainfall_mm: number;
  status: FarmStatus;
  evaluation: DroughtEvaluation;
  last_observation_date: string;
  source: DataSource;
  ndvi_source?: NdviSource;
  rainfall_source?: RainfallSource;
  observations_count: number;
  provenance?: ProvenanceSummary;
  observations?: DailyObservation[];
}

export interface SimulationResult {
  triggered: boolean;
  txHash: string;
  explorerUrl: string;
  method: 'soroban-contract' | 'xlm-payment';
  evaluation: DroughtEvaluation;
  farmId: string;
  farmerName: string;
  recipientAddress: string;
  proofHash: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}
