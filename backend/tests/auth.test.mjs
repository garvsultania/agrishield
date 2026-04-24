import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let requireAdminToken;
let constantTimeEqual;

beforeEach(() => {
  delete require.cache[require.resolve('../middleware/auth')];
  const mod = require('../middleware/auth');
  requireAdminToken = mod.requireAdminToken;
  constantTimeEqual = mod._internal.constantTimeEqual;
  delete process.env.ADMIN_API_TOKEN;
});

function makeReq(authorization) {
  return { headers: authorization === undefined ? {} : { authorization } };
}

function makeRes() {
  const res = {};
  res.status = (code) => {
    res._status = code;
    return res;
  };
  res.json = (body) => {
    res._body = body;
    return res;
  };
  return res;
}

describe('requireAdminToken', () => {
  it('is a no-op when ADMIN_API_TOKEN is unset (dev mode)', () => {
    const next = vi.fn();
    const res = makeRes();
    requireAdminToken(makeReq(), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res._status).toBeUndefined();
  });

  it('returns 401 when the token is configured and missing', () => {
    process.env.ADMIN_API_TOKEN = 'secret-xyz';
    const next = vi.fn();
    const res = makeRes();
    requireAdminToken(makeReq(), res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(res._body.error).toMatch(/Unauthorized/);
  });

  it('returns 401 on token mismatch', () => {
    process.env.ADMIN_API_TOKEN = 'secret-xyz';
    const next = vi.fn();
    const res = makeRes();
    requireAdminToken(makeReq('Bearer not-the-right-one'), res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and attaches a masked token on match', () => {
    process.env.ADMIN_API_TOKEN = 'secret-abcdefghij';
    const next = vi.fn();
    const res = makeRes();
    const req = makeReq('Bearer secret-abcdefghij');
    requireAdminToken(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.adminToken.masked).toBe('secr…ghij');
  });

  it('is case-insensitive on the Bearer scheme', () => {
    process.env.ADMIN_API_TOKEN = 'secret';
    const next = vi.fn();
    requireAdminToken(makeReq('bearer   secret'), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('constantTimeEqual', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
  });
  it('returns false for equal-length mismatches', () => {
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
  });
  it('returns false for different lengths', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});

// vi import sugar
import { vi } from 'vitest';
