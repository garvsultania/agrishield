import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MiniChart } from '@/components/mini-chart';

describe('<MiniChart />', () => {
  it('renders a shimmer placeholder for empty data', () => {
    const { container } = render(<MiniChart points={[]} />);
    expect(container.querySelector('.shimmer')).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders the correct number of bars in bar mode', () => {
    const { container } = render(<MiniChart points={[1, 2, 3, 4, 5]} kind="bar" label="Test bars" />);
    expect(container.querySelectorAll('rect')).toHaveLength(5);
  });

  it('renders a single line path in line mode', () => {
    const { container } = render(<MiniChart points={[1, 2, 3]} kind="line" label="Test line" />);
    const svg = container.querySelector('svg')!;
    const path = svg.querySelector('path');
    expect(path).toBeTruthy();
    expect(path?.getAttribute('d')).toMatch(/M/);
  });

  it('exposes role=img and aria-label', () => {
    const { container } = render(<MiniChart points={[1, 2, 3]} label="NDVI trend" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('NDVI trend');
  });

  it('draws a dashed threshold line when threshold is given', () => {
    const { container } = render(<MiniChart points={[1, 2, 3]} kind="bar" threshold={2.5} label="T" />);
    expect(container.querySelector('line[stroke-dasharray]')).toBeTruthy();
  });
});
