import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/**
 * Inline favicon — lime square with a white sparkle glyph, matching the
 * header logo tile. No raster asset required.
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
          fontSize: 20,
          fontFamily: 'sans-serif',
          fontWeight: 800,
        }}
      >
        ✦
      </div>
    ),
    { ...size }
  );
}
