'use client';

import dynamic from 'next/dynamic';
import Footer from '@/components/Footer';

// The IDE reads localStorage and URL params at mount, which means there's
// no sensible server-rendered first paint. Disabling SSR for this client
// component eliminates the hydration mismatch and matches the actual
// rendering story (IDE is interactive-only).
const IDE = dynamic(() => import('@/components/IDE'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        flex: 1,
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
  // app-root applies 100dvh (with 100vh fallback) so iOS Safari's
  // shrinking visible area is respected. The IDE takes `flex-1 min-h-0` so
  // it fills the remaining height; the Footer takes its natural height.
  // min-h-0 is required so the IDE's nested flex containers actually shrink.
  return (
    <div className="app-root flex flex-col min-h-0">
      <div className="flex-1 min-h-0 flex flex-col">
        <IDE />
      </div>
      <Footer />
    </div>
  );
}
