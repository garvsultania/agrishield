/**
 * Runtime-readable env constants, with fallbacks to the values deployed on
 * testnet. Override via `.env.local` using `NEXT_PUBLIC_*` keys.
 */
export const SOROBAN_CONTRACT_ID =
  process.env.NEXT_PUBLIC_SOROBAN_CONTRACT_ID ||
  'CBQ3QTCA2552XXBVJCKVRWTRMNHMYAAJC6PR4N5IXIYNVJCQFPLD7XLX';

export const ADMIN_PUBKEY =
  process.env.NEXT_PUBLIC_ADMIN_PUBKEY ||
  'GDEF3Z6T3F5HY6IZ4W7MO4R7OSLPQVMPXVQKC55OVF73MJKBNHC7QUT2';

export const STELLAR_NETWORK = 'testnet';

export const HORIZON_URL = 'https://horizon-testnet.stellar.org';

export const PAYOUT_PER_FARM_XLM = 100;

export const NDVI_THRESHOLD = 0.35;
export const RAINFALL_THRESHOLD_MM = 10;
export const OBSERVATION_WINDOW_DAYS = 14;
