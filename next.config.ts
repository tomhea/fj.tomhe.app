import type { NextConfig } from 'next';

// We ship a custom Node server (`server.ts`) for the WebSocket runner —
// `output: 'standalone'` would generate its own server.js which conflicts
// with that, and the rsync deploy workflow doesn't use standalone output
// anyway. So we run with the default output mode.
const nextConfig: NextConfig = {};

export default nextConfig;
