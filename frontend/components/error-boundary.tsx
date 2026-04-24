'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

/**
 * Catches render-time errors in the child tree and shows a recovery UI.
 * No external crash-reporting integration — errors are logged to console only.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="mx-auto my-10 flex max-w-xl flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6"
      >
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="text-base font-semibold">Something went wrong</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          The dashboard hit an unexpected render error. The error has been logged to the console.
        </p>
        <code className="max-w-full overflow-x-auto rounded-lg bg-background/60 p-3 text-xs text-foreground">
          {error.message}
        </code>
        <Button variant="outline" size="sm" onClick={this.reset}>
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      </div>
    );
  }
}
