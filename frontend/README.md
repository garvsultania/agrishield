# AgriShield frontend

Next.js 14 app-router dashboard for the AgriShield parametric drought oracle.

## Stack

- **Next.js 14** app router, TypeScript strict
- **Tailwind CSS 3** with HSL design tokens (`app/globals.css`)
- **shadcn/ui**-style primitives (hand-rolled against Radix UI) in `components/ui/*`
- **next-themes** for dark/light mode with `class` strategy
- **cmdk** for the ⌘K command palette
- **sonner** for toasts
- **Leaflet** + ESRI World Imagery for the satellite map
- **Vitest** + **@testing-library/react** + **jsdom** for tests

## Routes

| Path         | Purpose                                                     |
| ------------ | ----------------------------------------------------------- |
| `/`          | Overview — hero + metric cards w/ sparklines + NDVI banner  |
| `/map`       | Satellite map with legend, fly-to-on-select, drawer         |
| `/farms`     | Sortable, searchable, filterable farms table + CSV export   |
| `/pools`     | Soroban pool cards, depletion progress, simulate drawer     |
| `/payouts`   | localStorage-persisted payout history, filter + CSV export  |
| `/analytics` | Per-farm NDVI + rainfall + soil moisture + compare overlay  |
| `/wallet`    | Admin + farm wallets with live Horizon XLM balance          |

Farm detail drawer is deep-linkable via `?farm=SITAPUR_001` on any route that opens it.

## Environment

Copy `.env.local.example` → `.env.local` to override the defaults.

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOROBAN_CONTRACT_ID=CBQ3...
NEXT_PUBLIC_ADMIN_PUBKEY=GDEF...
```

Defaults (live on testnet) are coded into `lib/env.ts`; override for staging /
rotation without source edits.

## Keyboard shortcuts

| Keys  | Action               |
| ----- | -------------------- |
| `⌘K` / `Ctrl+K` | Command palette |
| `g` then `o/m/f/p/y/a/w` | Jump to Overview/Map/Farms/Pools/paYouts/Analytics/Wallet |
| `t`   | Toggle theme         |
| `?`   | Help & glossary      |

## Develop

```bash
npm install
npm run dev          # :3002
npm run test         # vitest (unit + component)
npm run test:watch
npm run typecheck    # tsc --noEmit
npm run build
```

The backend (`../backend`) must be running on `:3001` for farm status + simulate
endpoints to resolve.

## Architecture notes

- **DashboardProvider** (`components/dashboard-provider.tsx`) holds statuses,
  errors, loading, `lastUpdated`, and payouts. Mounted once in the `(dashboard)`
  route group. Refetches on window focus with a 15 s cooldown.
- **DashboardShell** owns keyboard shortcuts, command palette, help dialog,
  and the sticky header/sidebar chrome.
- **payouts-store** (`lib/payouts-store.ts`) is a thin localStorage-backed
  observable store with `subscribe()` — pages re-render automatically when a
  payout is saved from any drawer.
- **Status semantics** are centralised in `components/ui/status-pill.tsx` —
  `StatusPill` + `getFarmStatusTone` — so new status surfaces never regress
  into color-only.

See `DEFERRED.md` for audit items explicitly out of scope for this pass.
