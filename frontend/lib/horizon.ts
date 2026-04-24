import axios from 'axios';
import { HORIZON_URL } from '@/lib/env';

export interface HorizonBalance {
  balance: string;
  asset_type: string;
  asset_code?: string;
}

export interface AccountSnapshot {
  address: string;
  xlm: number; // native balance as a number, rounded to 4 decimals
  fundedOnChain: boolean;
}

/**
 * Fetch a Stellar account's native XLM balance via Horizon.
 * Returns `fundedOnChain: false` for 404 responses (accounts not yet funded).
 */
export async function fetchAccount(address: string): Promise<AccountSnapshot> {
  try {
    const { data } = await axios.get<{ balances: HorizonBalance[] }>(
      `${HORIZON_URL}/accounts/${address}`,
      { timeout: 8000 }
    );
    const native = data.balances.find((b) => b.asset_type === 'native');
    const xlm = native ? Number.parseFloat(native.balance) : 0;
    return {
      address,
      xlm: Number.isFinite(xlm) ? xlm : 0,
      fundedOnChain: true,
    };
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return { address, xlm: 0, fundedOnChain: false };
    }
    throw err;
  }
}

export function formatXlm(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
