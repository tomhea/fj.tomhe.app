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

const SITE_URL = 'https://fj.tomhe.app';

export const metadata: Metadata = {
  title: 'FlipJump IDE',
  description:
    'Online IDE for the FlipJump esoteric programming language — write, compile, and run FJ programs directly in your browser. Includes a built-in standard-library viewer, multi-file projects, BF→FJ and C→FJ converters, and shareable links.',
  keywords: [
    'FlipJump', 'flip-jump', 'FJ', 'esoteric programming', 'esolang',
    'online IDE', 'compiler', 'WebAssembly', 'bit manipulation',
  ],
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: 'FlipJump IDE',
    description:
      'Write, compile, and run FlipJump programs in your browser. The single-instruction esoteric language with a rich standard library.',
    siteName: 'FlipJump IDE',
  },
  twitter: {
    card: 'summary',
    title: 'FlipJump IDE',
    description: 'Write, compile, and run FlipJump programs in your browser.',
  },
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
