'use strict';

/**
 * Bearer-token guard for write endpoints (today: /simulate).
 *
 * Two modes:
 *   - When ADMIN_API_TOKEN is set: requests must send
 *       Authorization: Bearer <ADMIN_API_TOKEN>
 *     Mismatched / missing tokens → 401.
 *   - When ADMIN_API_TOKEN is unset: the guard is a no-op. On first use in
 *     this mode we log a one-time warning so operators know the endpoint is
 *     reachable unauthenticated.
 *
 * This is a deploy-time shared secret, not per-user auth. It defends against
 * casual abuse from anyone who can reach the backend URL. For a
 * browser-based dashboard the secret will necessarily be present in the
 * client bundle (NEXT_PUBLIC_API_TOKEN) — treat it as a floor, not a wall.
 * Rate limiting + CORS whitelist give the other two layers.
 */

let warnedMissingToken = false;

function maskToken(token) {
  if (!token) return '<unset>';
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function requireAdminToken(req, res, next) {
  const configured = process.env.ADMIN_API_TOKEN;

  if (!configured) {
    if (!warnedMissingToken) {
      warnedMissingToken = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[auth] ADMIN_API_TOKEN is not set — /simulate is reachable without authentication. OK for dev; do not ship this to prod.'
      );
    }
    return next();
  }

  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const supplied = match ? match[1].trim() : '';

  if (!supplied || !constantTimeEqual(supplied, configured)) {
    return res.status(401).json({
      success: false,
      data: null,
      error: 'Unauthorized — Bearer token required on this endpoint',
    });
  }

  req.adminToken = { masked: maskToken(configured) };
  return next();
}

/**
 * Compares two strings without early exit, dodging timing-side-channel
 * fingerprinting of the admin token. Strings of different lengths still
 * return false but the loop runs to the longer length first.
 */
function constantTimeEqual(a, b) {
  const lenA = a.length;
  const lenB = b.length;
  const max = Math.max(lenA, lenB);
  let diff = lenA ^ lenB;
  for (let i = 0; i < max; i++) {
    const ca = i < lenA ? a.charCodeAt(i) : 0;
    const cb = i < lenB ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

module.exports = { requireAdminToken, _internal: { constantTimeEqual, maskToken } };
