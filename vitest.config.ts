import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Playwright E2E lives under tests/e2e/ and is run separately.
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environment: 'node',
    // server-runner tests spawn a child server and connect via WS; the
    // tsx bootstrap + Next.js dev compile take >5s on cold start.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
