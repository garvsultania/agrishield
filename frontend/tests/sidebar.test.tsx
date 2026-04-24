import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '@/components/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('next/navigation', () => ({
  usePathname: () => '/farms',
}));

describe('<Sidebar />', () => {
  it('marks the current route as aria-current="page"', () => {
    render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>
    );
    const active = screen.getByRole('link', { name: /Farms/i });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveAttribute('href', '/farms');
  });

  it('exposes sr-only text labels for every nav item', () => {
    render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>
    );
    for (const label of ['Overview', 'Satellite map', 'Farms', 'Pools', 'Payouts', 'Analytics', 'Wallet']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('wraps the nav in an aria-labelled region', () => {
    const { container } = render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>
    );
    expect(container.querySelector('aside[aria-label="Primary"]')).toBeTruthy();
  });
});
