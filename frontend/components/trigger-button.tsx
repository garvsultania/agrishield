'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ArrowUpRight, CheckCircle2, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { simulatePayout } from '@/lib/api';
import type { SimulationResult } from '@/lib/types';

interface TriggerButtonProps {
  farmId: string | null;
  onSuccess?: (result: SimulationResult) => void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; result: SimulationResult }
  | { kind: 'error'; message: string };

/**
 * Compact primary CTA. Toast handles success announcement; this component
 * only surfaces the button, an inline success stub (tx link), and an inline
 * error (retryable).
 */
export function TriggerButton({ farmId, onSuccess }: TriggerButtonProps) {
  const [state, setState] = React.useState<State>({ kind: 'idle' });
  const inflightRef = React.useRef(false);

  async function handleClick() {
    if (!farmId) return;
    if (inflightRef.current) return;
    inflightRef.current = true;
    setState({ kind: 'loading' });
    try {
      const result = await simulatePayout(farmId);
      setState({ kind: 'success', result });
      onSuccess?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Simulation failed';
      setState({ kind: 'error', message });
      toast.error('Simulation failed', { description: message });
    } finally {
      inflightRef.current = false;
    }
  }

  const isLoading = state.kind === 'loading';

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="lime"
        size="lg"
        onClick={handleClick}
        disabled={isLoading || !farmId}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Simulating…
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Simulate drought &amp; trigger payout
          </>
        )}
      </Button>

      {!farmId && (
        <p className="text-center text-[11px] italic text-muted-foreground">
          Pick a farm to enable simulation
        </p>
      )}

      {state.kind === 'success' && (
        <a
          href={state.result.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-between gap-2 rounded-md border border-success/25 bg-success/10 px-3 py-1.5 text-[11px] transition hover:bg-success/15"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold text-success">
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            Payout triggered
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {state.result.txHash.slice(0, 10)}…
          </span>
          <ArrowUpRight className="h-3 w-3 text-muted-foreground" aria-hidden />
        </a>
      )}

      {state.kind === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive"
        >
          {state.message}
        </div>
      )}
    </div>
  );
}
