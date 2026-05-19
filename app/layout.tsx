import type { Metadata, Viewport } from 'next';
import './globals.css';

/**
 * viewport-fit=cover lets the page extend edge-to-edge on iPhone notch /
 * Dynamic Island / home-indicator screens. We then use
 * env(safe-area-inset-*) in CSS to keep interactive content clear of those
 * areas. Without this the safe-area env() vars are always 0.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'FlipJump Interpreter',
  description: 'Online IDE for the FlipJump esoteric programming language — write, compile, and run FJ programs in your browser.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-32.png', type: 'image/png', sizes: '128x128' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ height: '100%', margin: 0 }}>{children}</body>
    </html>
  );
}
