'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ArrowUpRight, Check, Copy, RefreshCw, ShieldCheck, Wallet as WalletIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import { PageHeader } from '@/components/page-header';
import { farms } from '@/lib/farms-data';
import { truncateAddress } from '@/lib/utils';
import { SOROBAN_CONTRACT_ID, ADMIN_PUBKEY } from '@/lib/env';
import { fetchAccount, formatXlm, type AccountSnapshot } from '@/lib/horizon';

interface BalancesState {
  loading: boolean;
  error: string | null;
  snapshots: Record<string, AccountSnapshot>;
}

export default function WalletPage() {
  const [state, setState] = React.useState<BalancesState>({
    loading: true,
    error: null,
    snapshots: {},
  });

  const load = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const addresses = [ADMIN_PUBKEY, ...farms.map((f) => f.walletAddress)];
    try {
      const results = await Promise.allSettled(addresses.map(fetchAccount));
      const snapshots: Record<string, AccountSnapshot> = {};
      results.forEach((r, i) => {
        const addr = addresses[i];
        if (r.status === 'fulfilled') {
          snapshots[addr] = r.value;
        } else {
          snapshots[addr] = { address: addr, xlm: 0, fundedOnChain: false };
        }
      });
      setState({ loading: false, error: null, snapshots });
    } catch (err) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : 'Horizon unreachable',
        snapshots: {},
      });
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const adminSnapshot = state.snapshots[ADMIN_PUBKEY];

  return (
    <>
      <PageHeader
        eyebrow="Wallet"
        title="Oracle admin keypair & contract"
        description="The backend signs trigger_payout with this testnet keypair. Live balances are fetched directly from Stellar Horizon."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={state.loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} />
            Refresh balances
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle>Admin identity</CardTitle>
            <Badge variant="violet">
              <WalletIcon className="h-3 w-3" aria-hidden />
              TESTNET
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoBlock label="Public key" value={ADMIN_PUBKEY} mono />
            <div className="grid grid-cols-2 gap-2">
              <InfoBlock
                label="XLM balance"
                value={
                  state.loading
                    ? '—'
                    : adminSnapshot?.fundedOnChain
                    ? formatXlm(adminSnapshot.xlm)
                    : 'Unfunded'
                }
                hint={adminSnapshot?.fundedOnChain === false ? 'Account not on testnet' : undefined}
              />
              <InfoBlock label="Network" value="Stellar testnet" />
            </div>
            <a
              href={`https://stellar.expert/explorer/testnet/account/${ADMIN_PUBKEY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-violet hover:underline"
            >
              Account on stellar.expert
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </a>
            <Separator />
            <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
              Admin secret is read from <code className="font-mono">backend/.env</code> and never
              exposed to the browser. Rotate via your deploy flow.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle>Pool contract</CardTitle>
            <Badge variant="lime">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              DEPLOYED
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoBlock label="Contract ID" value={SOROBAN_CONTRACT_ID} mono />
            <div className="grid grid-cols-2 gap-2">
              <InfoBlock label="Pools" value={String(farms.length)} />
              <InfoBlock label="Payout / farm" value="100 XLM" />
            </div>
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${SOROBAN_CONTRACT_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-violet hover:underline"
            >
              Contract on stellar.expert
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </a>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>Farm recipient wallets</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Each farmer has a funded testnet account. Live XLM balance via Horizon.
            </p>
          </div>
          {state.error && <Badge variant="warn">Horizon unreachable</Badge>}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {farms.map((farm) => {
            const snap = state.snapshots[farm.walletAddress];
            return (
              <WalletRow
                key={farm.farmId}
                farmId={farm.farmId}
                name={farm.farmerName}
                address={farm.walletAddress}
                balance={
                  state.loading
                    ? '—'
                    : snap?.fundedOnChain
                    ? `${formatXlm(snap.xlm)} XLM`
                    : 'Unfunded'
                }
              />
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}

function InfoBlock({
  label,
  value,
  mono,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-secondary/40 p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-0.5 break-all text-sm ${mono ? 'font-mono text-xs' : 'font-semibold num'}`}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function WalletRow({
  farmId,
  name,
  address,
  balance,
}: {
  farmId: string;
  name: string;
  address: string;
  balance: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success('Address copied', { description: `${name} · ${truncateAddress(address, 5, 5)}` });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="font-mono text-[11px] text-muted-foreground">
          {farmId} · {truncateAddress(address, 5, 5)}
        </div>
      </div>
      <div className="text-right">
        <div className="num text-xs font-semibold">{balance}</div>
      </div>
      <Button variant="ghost" size="icon" onClick={copy} aria-label={`Copy ${name} address`}>
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
      </Button>
    </div>
  );
}
