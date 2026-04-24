import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPill, getFarmStatusTone } from '@/components/ui/status-pill';

describe('<StatusPill />', () => {
  it('renders the default label for a given tone', () => {
    render(<StatusPill tone="drought" />);
    expect(screen.getByRole('status')).toHaveTextContent(/drought/i);
  });

  it('honors a custom label', () => {
    render(<StatusPill tone="healthy" label="All good" />);
    expect(screen.getByRole('status')).toHaveTextContent('All good');
  });

  it('sets an accessible aria-label', () => {
    render(<StatusPill tone="paid" />);
    const pill = screen.getByRole('status');
    expect(pill).toHaveAttribute('aria-label', 'Paid');
  });

  it('renders an icon for every tone', () => {
    const tones = ['drought', 'healthy', 'armed', 'paid', 'loading', 'error', 'unknown'] as const;
    for (const tone of tones) {
      const { container, unmount } = render(<StatusPill tone={tone} />);
      expect(container.querySelector('svg')).toBeTruthy();
      unmount();
    }
  });
});

describe('getFarmStatusTone()', () => {
  it('prefers error when both status and error are present', () => {
    expect(getFarmStatusTone({ status: 'drought', error: 'x' })).toBe('error');
  });

  it('returns loading when status is missing and no error is set', () => {
    expect(getFarmStatusTone({ loading: true })).toBe('loading');
  });

  it('maps drought/healthy status values through', () => {
    expect(getFarmStatusTone({ status: 'drought' })).toBe('drought');
    expect(getFarmStatusTone({ status: 'healthy' })).toBe('healthy');
  });

  it('falls back to unknown when status is empty', () => {
    expect(getFarmStatusTone({})).toBe('unknown');
  });
});
