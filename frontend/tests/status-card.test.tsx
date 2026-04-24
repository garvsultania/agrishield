import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusCard } from '@/components/status-card';
import type { Farm, DroughtEvaluation } from '@/lib/types';

const farm: Farm = {
  farmId: 'SITAPUR_001',
  farmerName: 'Ramesh Kumar',
  coordinates: { lat: 27.5706, lng: 80.6822 },
  polygon: [],
  areaSqKm: 0.5,
  cropType: 'wheat',
  walletAddress: 'GDU34N2INDZ2OZS5LLKJFKQGNWT2RIIXJZLYMRVQ44DB4TCFMO56SWG3',
};

const droughtEval: DroughtEvaluation = {
  triggered: true,
  reason: 'Drought confirmed over 14-day window.',
  confidence: 'high',
  proof_of_loss: {
    avg_ndvi: 0.25,
    avg_rainfall_mm: 0.76,
    min_ndvi: 0.21,
    max_rainfall_mm: 3,
    days_evaluated: 14,
    ndvi_threshold: 0.35,
    rainfall_threshold_mm: 10,
    observation_window: { start: '2026-04-10', end: '2026-04-23' },
    data_source: 'simulated',
  },
};

const healthyEval: DroughtEvaluation = {
  ...droughtEval,
  triggered: false,
  reason: 'All metrics within normal range.',
  confidence: 'medium',
};

describe('<StatusCard />', () => {
  it('renders drought headline when evaluation.triggered is true', () => {
    render(
      <StatusCard
        farm={farm}
        evaluation={droughtEval}
        ndvi={0.21}
        rainfall_mm={0}
        source="simulated"
      />
    );
    expect(screen.getByText(/Drought detected/i)).toBeInTheDocument();
    expect(screen.getByText(/NDVI 0\.210.*Rain 0\.0mm/)).toBeInTheDocument();
  });

  it('renders healthy headline when evaluation.triggered is false', () => {
    render(
      <StatusCard
        farm={farm}
        evaluation={healthyEval}
        ndvi={0.62}
        rainfall_mm={34}
        source="mock"
      />
    );
    expect(screen.getByText(/Crop healthy/i)).toBeInTheDocument();
  });

  it('displays the confidence label from the evaluation', () => {
    render(
      <StatusCard
        farm={farm}
        evaluation={droughtEval}
        ndvi={0.21}
        rainfall_mm={0}
        source="simulated"
      />
    );
    // Badge text uses the bare confidence keyword; accessible name spells it out
    expect(screen.getByLabelText(/Confidence: high/i)).toBeInTheDocument();
  });

  it('renders the proof-of-loss block when drought fires', () => {
    render(
      <StatusCard
        farm={farm}
        evaluation={droughtEval}
        ndvi={0.21}
        rainfall_mm={0}
        source="simulated"
      />
    );
    expect(screen.getByText(/Proof of loss/i)).toBeInTheDocument();
    expect(screen.getByText('0.250')).toBeInTheDocument();
    expect(screen.getByText(/0\.76mm/)).toBeInTheDocument();
  });

  it('shows a shimmer placeholder when evaluation is undefined', () => {
    const { container } = render(
      <StatusCard
        farm={farm}
        evaluation={undefined}
        ndvi={undefined}
        rainfall_mm={undefined}
        source={undefined}
      />
    );
    expect(container.querySelectorAll('.shimmer').length).toBeGreaterThan(0);
  });

  it('surfaces real-data provenance chips when sources are specified', () => {
    render(
      <StatusCard
        farm={farm}
        evaluation={droughtEval}
        ndvi={0.21}
        rainfall_mm={0}
        source="hybrid"
        ndviSource="sentinel-2"
        rainfallSource="open-meteo"
      />
    );
    expect(screen.getByText('NDVI')).toBeInTheDocument();
    expect(screen.getByText(/Sentinel-2/)).toBeInTheDocument();
    expect(screen.getByText('Rain')).toBeInTheDocument();
    expect(screen.getByText(/Open-Meteo/)).toBeInTheDocument();
  });
});
