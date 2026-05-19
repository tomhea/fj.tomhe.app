import type { Metadata } from 'next';
import './globals.css';

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
