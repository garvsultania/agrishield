import raw from '../../data/historical_ndvi.json';

export interface DailyObservation {
  date: string;
  ndvi: number;
  rainfall_mm: number;
  soil_moisture: number;
}

export interface FarmHistory {
  farmId: string;
  observations: DailyObservation[];
}

export const historicalData: FarmHistory[] = raw as FarmHistory[];

export function getHistory(farmId: string): DailyObservation[] {
  const entry = historicalData.find((h) => h.farmId === farmId);
  return entry?.observations ?? [];
}
