import type { Metadata } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import { Toaster } from 'sonner';

import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'AgriShield — Parametric Crop Insurance',
  description:
    'Satellite-driven drought oracle for Sitapur smallholder farms. Triggers Soroban smart-contract payouts on Stellar testnet.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={150}>
            <ErrorBoundary>{children}</ErrorBoundary>
            <Toaster
              position="bottom-right"
              toastOptions={{
                classNames: {
                  toast:
                    'group glass !rounded-2xl !border-border/60 !text-foreground !shadow-xl',
                  description: '!text-muted-foreground',
                  actionButton: '!bg-primary !text-primary-foreground',
                },
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
