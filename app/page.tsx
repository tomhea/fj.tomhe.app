'use client';

import dynamic from 'next/dynamic';

// The IDE reads localStorage and URL params at mount, which means there's
// no sensible server-rendered first paint. Disabling SSR for this client
// component eliminates the hydration mismatch and matches the actual
// rendering story (IDE is interactive-only).
const IDE = dynamic(() => import('@/components/IDE'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '100vh',
        background: '#1e1e1e',
        color: '#969696',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 13,
      }}
    >
      Loading FlipJump IDE…
    </div>
  ),
});

export default function Home() {
  return <IDE />;
}
