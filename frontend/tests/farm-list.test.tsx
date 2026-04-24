import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FarmList } from '@/components/farm-list';
import type { Farm, FarmStatusResponse } from '@/lib/types';

const farms: Farm[] = [
  {
    farmId: 'SITAPUR_001',
    farmerName: 'Ramesh Kumar',
    coordinates: { lat: 27.5706, lng: 80.6822 },
    polygon: [],
    areaSqKm: 0.5,
    cropType: 'wheat',
    walletAddress: 'GDU34N2INDZ2OZS5LLKJFKQGNWT2RIIXJZLYMRVQ44DB4TCFMO56SWG3',
  },
  {
    farmId: 'SITAPUR_002',
    farmerName: 'Sunita Devi',
    coordinates: { lat: 27.5756, lng: 80.6872 },
    polygon: [],
    areaSqKm: 0.4,
    cropType: 'wheat',
    walletAddress: 'GDEFEH3ZEWQXIVHTYIXOAUCFLFGABG6SB5IZBRUAWOWT7MHL7ZHKWYIP',
  },
];

function makeStatus(farmId: string, status: 'drought' | 'healthy', ndvi: number): FarmStatusResponse {
  return {
    farmId,
    farmerName: 'stub',
    cropType: 'wheat',
    areaSqKm: 0.5,
    coordinates: { lat: 0, lng: 0 },
    walletAddress: 'GSTUB',
    ndvi,
    rainfall_mm: 0,
    status,
    source: 'mock',
    last_observation_date: '2026-04-23',
    observations_count: 14,
    evaluation: {
      triggered: status === 'drought',
      reason: '',
      confidence: 'high',
      proof_of_loss: {
        avg_ndvi: ndvi,
        avg_rainfall_mm: 0,
        min_ndvi: ndvi,
        max_rainfall_mm: 0,
        days_evaluated: 14,
        ndvi_threshold: 0.35,
        rainfall_threshold_mm: 10,
        observation_window: { start: '', end: '' },
        data_source: 'mock',
      },
    },
  };
}

describe('<FarmList />', () => {
  const statuses = {
    SITAPUR_001: makeStatus('SITAPUR_001', 'drought', 0.21),
    SITAPUR_002: makeStatus('SITAPUR_002', 'healthy', 0.58),
  };

  it('renders every farm name', () => {
    render(
      <FarmList
        farms={farms}
        farmStatuses={statuses}
        fetchErrors={{}}
        selectedFarmId={null}
        onSelect={() => undefined}
      />
    );
    expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
    expect(screen.getByText('Sunita Devi')).toBeInTheDocument();
  });

  it('shows formatted NDVI for each farm', () => {
    render(
      <FarmList
        farms={farms}
        farmStatuses={statuses}
        fetchErrors={{}}
        selectedFarmId={null}
        onSelect={() => undefined}
      />
    );
    expect(screen.getByText('0.210')).toBeInTheDocument();
    expect(screen.getByText('0.580')).toBeInTheDocument();
  });

  it('calls onSelect with the correct farmId when a row is clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <FarmList
        farms={farms}
        farmStatuses={statuses}
        fetchErrors={{}}
        selectedFarmId={null}
        onSelect={onSelect}
      />
    );
    await user.click(screen.getByRole('button', { name: /Sunita Devi/i }));
    expect(onSelect).toHaveBeenCalledWith('SITAPUR_002');
  });

  it('surfaces an error marker when a farm fetch failed', () => {
    render(
      <FarmList
        farms={farms}
        farmStatuses={{ SITAPUR_001: statuses.SITAPUR_001 }}
        fetchErrors={{ SITAPUR_002: 'Network timeout' }}
        selectedFarmId={null}
        onSelect={() => undefined}
      />
    );
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
