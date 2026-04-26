import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/**
 * Inline favicon — lime square with a stylised "A" in dark green. We avoid
 * non-Latin glyphs (e.g. ✦) because @vercel/og has to dynamically fetch a
 * Google font for them at build time, which fails behind some proxies and
 * fails the production build outright.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
          background: '#bef264',
          color: '#14532d',
          fontSize: 22,
          fontFamily: 'sans-serif',
          fontWeight: 900,
          letterSpacing: '-0.05em',
        }}
      >
        A
      </div>
    ),
    { ...size }
  );
}
