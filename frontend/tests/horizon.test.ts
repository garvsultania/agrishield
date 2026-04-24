import { describe, it, expect, vi, afterEach } from 'vitest';
import axios from 'axios';
import { fetchAccount, formatXlm } from '@/lib/horizon';

vi.mock('axios', async (importOriginal) => {
  const actual: typeof import('axios') = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn(),
      isAxiosError: actual.default.isAxiosError,
    },
  };
});

const mockedGet = vi.mocked(axios.get);

describe('fetchAccount()', () => {
  afterEach(() => {
    mockedGet.mockReset();
  });

  it('returns native XLM balance when Horizon returns 200', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        balances: [
          { asset_type: 'native', balance: '9123.4567890' },
          { asset_type: 'credit_alphanum4', balance: '1.0' },
        ],
      },
    });
    const snap = await fetchAccount('GADMIN');
    expect(snap.xlm).toBeCloseTo(9123.456789, 5);
    expect(snap.fundedOnChain).toBe(true);
  });

  it('treats a 404 from Horizon as an unfunded account', async () => {
    const err = new Error('not found') as Error & { response?: { status: number } };
    err.response = { status: 404 };
    (err as any).isAxiosError = true;
    mockedGet.mockRejectedValueOnce(err);
    const snap = await fetchAccount('GUNKNOWN');
    expect(snap.fundedOnChain).toBe(false);
    expect(snap.xlm).toBe(0);
  });

  it('defaults to zero when no native balance is present', async () => {
    mockedGet.mockResolvedValueOnce({ data: { balances: [] } });
    const snap = await fetchAccount('GEMPTY');
    expect(snap.xlm).toBe(0);
    expect(snap.fundedOnChain).toBe(true);
  });
});

describe('formatXlm()', () => {
  it('formats with two-decimal precision and thousand separators', () => {
    expect(formatXlm(9123.456789)).toMatch(/9,?123\.46/);
    expect(formatXlm(0)).toBe('0.00');
  });

  it('returns em-dash for non-finite values', () => {
    expect(formatXlm(Number.NaN)).toBe('—');
    expect(formatXlm(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
