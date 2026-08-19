import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

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
          background: '#0B3C5D',
          borderRadius: 14,
          color: '#fff',
          fontSize: 30,
          fontWeight: 900,
          fontFamily: 'sans-serif',
          letterSpacing: -1,
        }}
      >
        SN
      </div>
    ),
    { ...size },
  );
}
