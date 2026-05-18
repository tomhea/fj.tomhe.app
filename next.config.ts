import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Custom server handles WebSocket; disable default Next.js server behavior
  output: 'standalone',
};

export default nextConfig;
