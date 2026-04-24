const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle into .next/standalone when the
  // NEXT_OUTPUT_STANDALONE env flag is set (used by frontend/Dockerfile).
  // Local `next dev` + `next build` without the flag are unchanged.
  ...(process.env.NEXT_OUTPUT_STANDALONE ? { output: 'standalone' } : {}),
  // The dashboard imports ../../data/*.json (farms, historical NDVI). Next's
  // file-tracing needs to know it's allowed to walk above the app root.
  outputFileTracingRoot: path.join(__dirname, '..'),
};

module.exports = nextConfig;
