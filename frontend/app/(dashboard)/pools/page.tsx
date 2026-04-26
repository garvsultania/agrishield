'use client';

import * as React from 'react';
import { ArrowUpRight, CircleDashed, Coins, ExternalLink, Zap } from 'lucide-react';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';

import { PageHeader } from '@/components/page-header';
import { FarmDetailDrawer } from '@/components/farm-detail-drawer';
import { useFarmUrlSync } from '@/components/use-farm-url-sync';
import { MiniChart } from '@/components/mini-chart';

import { farms } from '@/lib/farms-data';
import { useDashboard } from '@/components/dashboard-provider';
import { truncateAddress } from '@/lib/utils';
import { SOROBAN_CONTRACT_ID, PAYOUT_PER_FARM_XLM } from '@/lib/env';
import { timeAgo } from '@/lib/timeago';

export default function PoolsPage() {
  return (
    <React.Suspense fallback={null}>
      <PoolsPageInner />
    </React.Suspense>
  );
}

function PoolsPageInner() {
  const { getLastPayout, statuses, contractPaidSet } = useDashboard();
  const { selectedFarmId, openFarm, closeFarm } = useFarmUrlSync();

  // Union: on-chain state (ground truth) plus anything we just logged locally
  const paidFarmIds = React.useMemo(() => {
    const set = new Set(contractPaidSet);
    for (const f of farms) if (getLastPayout(f.farmId)) set.add(f.farmId);
    return set;
  }, [contractPaidSet, getLastPayout]);

  const totalLiquidity = farms.length * PAYOUT_PER_FARM_XLM;
  const netPaid = paidFarmIds.size * PAYOUT_PER_FARM_XLM;
  const remaining = totalLiquidity - netPaid;
  const paidRatio = totalLiquidity > 0 ? netPaid / totalLiquidity : 0;

  // Binary per-pool history for the distribution chart in the summary tile
  const liquidityBars = farms.map((f) => (paidFarmIds.has(f.farmId) ? 0 : PAYOUT_PER_FARM_XLM));

  return (
    <>
      <PageHeader
        eyebrow="Pools"
        title="Soroban insurance pools"
        description={`Each farm is backed by a ${PAYOUT_PER_FARM_XLM} XLM pool on the parametric_trigger contract. Pools are admin-bound with on-chain double-spend protection.`}
        actions={
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${SOROBAN_CONTRACT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              stellar.expert
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </a>
        }
      />

      {/* Summary tiles — each earns its space with data, not just a number */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryTile
          label="Liquidity"
          value={`${totalLiquidity}`}
          unit="XLM"
          hint={`${farms.length} pools · ${PAYOUT_PER_FARM_XLM} each`}
          chart={<MiniChart points={liquidityBars} kind="bar" label="Per-pool liquidity (armed shown, paid is zero)" width={200} height={44} className="text-lime" />}
        />
        <SummaryTile
          label="Depletion"
          value={`${netPaid}`}
          unit={`/ ${totalLiquidity} XLM`}
          hint={`${remaining} XLM across ${farms.length - paidFarmIds.size} armed`}
          right={
            <div
              className="flex h-10 items-end gap-0.5"
              role="progressbar"
              aria-label="Pool liquidity depleted"
              aria-valuenow={Math.round(paidRatio * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full w-1.5 rounded-sm bg-muted-foreground/20" />
              <div className="h-full w-full overflow-hidden rounded-sm bg-muted-foreground/10">
                <div
                  className="h-full rounded-sm violet-card transition-[width] duration-500"
                  style={{ width: `${Math.round(paidRatio * 100)}%` }}
                />
              </div>
            </div>
          }
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Contract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <div
              className="font-mono text-[11px] leading-relaxed text-foreground"
              title={SOROBAN_CONTRACT_ID}
            >
              {truncateAddress(SOROBAN_CONTRACT_ID, 12, 10)}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">parametric_trigger · testnet</span>
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${SOROBAN_CONTRACT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Contract on stellar.expert"
                className="text-muted-foreground transition hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Pool cards — content flows, footer for actions */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {farms.map((farm) => {
          const paid = paidFarmIds.has(farm.farmId);
          const lastPayout = getLastPayout(farm.farmId);
          const status = statuses[farm.farmId];
          const isDrought = status?.status === 'drought';
          return (
            <Card key={farm.farmId} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                <div className="min-w-0">
                  <CardTitle>Pool · {farm.farmId.replace('SITAPUR_', '')}</CardTitle>
                  <div className="mt-1 truncate text-[15px] font-semibold leading-tight tracking-tight">
                    {farm.farmerName}
                  </div>
                </div>
                <StatusPill tone={paid ? 'paid' : 'armed'} label={paid ? 'Paid' : 'Armed'} />
              </CardHeader>

              <CardContent className="flex-1 pt-0">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                  <Field label="Payout">
                    <span className="inline-flex items-center gap-1 num font-semibold">
                      <Coins className="h-3 w-3 text-lime-foreground dark:text-lime" aria-hidden />
                      {PAYOUT_PER_FARM_XLM} XLM
                    </span>
                  </Field>
                  <Field label="Crop">
                    <span className="capitalize font-medium">{farm.cropType}</span>
                  </Field>
                  <Field label="Recipient">
                    <span className="font-mono text-[11px]">{truncateAddress(farm.walletAddress, 4, 4)}</span>
                  </Field>
                  <Field label="NDVI">
                    <span className={`num font-semibold ${isDrought ? 'text-destructive' : ''}`}>
                      {status?.ndvi !== undefined ? status.ndvi.toFixed(3) : '—'}
                    </span>
                  </Field>
                </dl>

                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {paid ? (
                    <>
                      <CircleDashed className="h-3 w-3 text-success" aria-hidden />
                      Paid {lastPayout ? timeAgo(lastPayout.triggeredAt) : '—'}
                    </>
                  ) : isDrought ? (
                    <>
                      <CircleDashed className="h-3 w-3 text-destructive" aria-hidden />
                      Drought conditions — ready to trigger
                    </>
                  ) : (
                    <>
                      <CircleDashed className="h-3 w-3" aria-hidden />
                      Monitoring · no breach
                    </>
                  )}
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  variant={paid ? 'outline' : isDrought ? 'lime' : 'glass'}
                  size="sm"
                  onClick={() => openFarm(farm.farmId)}
                  className="text-[12px]"
                >
                  {paid ? (
                    <>Inspect</>
                  ) : isDrought ? (
                    <>
                      <Zap className="h-3 w-3" />
                      Simulate
                    </>
                  ) : (
                    <>Inspect</>
                  )}
                </Button>
                <a
                  href={`https://stellar.expert/explorer/testnet/contract/${SOROBAN_CONTRACT_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                >
                  Contract state
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </a>
              </CardFooter>
            </Card>
          );
        })}
      </section>

      <FarmDetailDrawer
        farmId={selectedFarmId}
        open={Boolean(selectedFarmId)}
        onOpenChange={(open) => (open ? undefined : closeFarm())}
        onNavigate={openFarm}
      />
    </>
  );
}

function SummaryTile({
  label,
  value,
  unit,
  hint,
  chart,
  right,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  chart?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 pt-5">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 flex items-baseline gap-1 leading-none">
            <span className="num text-2xl font-semibold tracking-tight">{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
          {hint && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{hint}</div>}
        </div>
        {(chart || right) && <div className="shrink-0">{chart ?? right}</div>}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-foreground">{children}</dd>
    </div>
  );
}
