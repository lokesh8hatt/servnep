import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'ServeNep — Verified Home Services in Kathmandu, Lalitpur & Bhaktapur';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #0B3C5D 0%, #14507a 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              display: 'flex',
              background: '#fff',
              color: '#0B3C5D',
              width: 76,
              height: 76,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            SN
          </div>
          <div style={{ display: 'flex', color: '#fff', fontSize: 42, fontWeight: 800 }}>ServeNep</div>
        </div>
        <div style={{ display: 'flex', color: '#fff', fontSize: 52, fontWeight: 900, maxWidth: 900, lineHeight: 1.15 }}>
          Verified Plumbers, Electricians &amp; Home Services
        </div>
        <div style={{ display: 'flex', color: '#9fc7e0', fontSize: 30, fontWeight: 600, marginTop: 24 }}>
          Kathmandu · Lalitpur · Bhaktapur
        </div>
      </div>
    ),
    { ...size },
  );
}
