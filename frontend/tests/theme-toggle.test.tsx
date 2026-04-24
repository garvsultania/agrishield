import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ThemeToggle } from '@/components/theme-toggle';

function withTheme(defaultTheme: 'dark' | 'light') {
  return (
    <NextThemesProvider attribute="class" defaultTheme={defaultTheme} enableSystem={false}>
      <ThemeToggle />
    </NextThemesProvider>
  );
}

describe('<ThemeToggle />', () => {
  it('flips aria-pressed when clicked', async () => {
    const user = userEvent.setup();
    render(withTheme('dark'));
    const btn = await screen.findByRole('button');
    // next-themes hydrates on mount; wait for the aria-pressed attribute to settle
    await act(async () => {
      await Promise.resolve();
    });
    expect(btn).toHaveAttribute('aria-pressed');
    const initial = btn.getAttribute('aria-pressed');
    await user.click(btn);
    expect(btn.getAttribute('aria-pressed')).not.toBe(initial);
  });

  it('announces the current theme to assistive tech', () => {
    render(withTheme('light'));
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toMatch(/Switch to/i);
  });
});
