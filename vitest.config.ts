import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    // Playwright E2E lives under tests/e2e/ and is run separately.
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environment: 'node',
    // Component tests (when added) can set `@vitest-environment jsdom` at the
    // top of each file instead of the old environmentMatchGlobs option, which
    // was removed in vitest v4.
    setupFiles: ['tests/setup.ts'],
    // server-runner tests spawn a child server and connect via WS; the
    // tsx bootstrap + Next.js dev compile take >5s on cold start.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
