# Deferred audit items

Items from the Sr. UI/UX audit that were not shipped in this pass, with reasons.
Keep in mind when scoping future work.

## Needs backend changes

- **Real on-chain `is_paid` reconciliation.** Pools page currently trusts
  `localStorage`. A backend endpoint like `/api/contract/is-paid/:farmId` that
  queries the Soroban contract would let the UI show ground truth.
- **Farms CRUD.** Data is a static JSON file; add/remove/edit needs a write API.
- **Auth.** `/simulate` fires a real testnet tx on every call. Demo-only today.
- **Global event log.** No backend-persisted activity feed; we only see what this
  device triggered.

## Needs a design asset

- **OG image / social card.** Requires a branded 1200×630 PNG.
- **PWA manifest + app icons.** Minimal favicon ships via `app/icon.tsx`; full
  install UX needs icon variants.

## Needs tooling / infra

- **Playwright E2E.** Browser install is heavy and the team disk is constrained.
  Vitest + @testing-library coverage was expanded instead. When you're ready:
  `npm i -D @playwright/test && npx playwright install chromium`.
- **jest-axe / axe-core.** Would add an automated a11y pass on top of the manual
  checks (aria-live, role=img, sr-only labels) this commit added.
- **Chromatic / Percy visual regression.** Requires a paid service or Storybook.
- **Sentry / observability.** Needs an account + DSN secret.
- **CI.** No `.github/workflows/*.yml` yet. The scripts (`test`, `typecheck`,
  `build`) are ready to run in CI — just add a YAML.

## Product-scope decisions we skipped

- **Basemap switcher** (satellite ↔ street). Low demo value.
- **Print stylesheets** for Payouts / Wallet. Low demo value.
- **Changelog / "what's new" surface.** Out of scope.
- **Settings page** (table density, date format, default landing page). Scope
  creep vs. current user count.

## Nice-to-haves punted because they'd double the delta

- **Per-farm balance polling interval** beyond one-shot on Wallet mount.
- **Drawer scroll position restore** across `?farm=` navigation.
- **Mobile bottom-nav** in addition to the hamburger sheet.
- **Analytics y-axis labels** (0 / threshold / max tick marks).
