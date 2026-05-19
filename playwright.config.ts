import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. The dev server is started by Playwright (`webServer`) on
 * port 3713 so the harness doesn't fight with a manually-running dev
 * server. fj / bf2fj must be on PATH (CI installs `flipjump` via pip).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // single dev server + WS rate-limit make parallel suites flaky
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:3713',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // We rely on the default Hello World; reset localStorage in each test
    // via the test fixture (see tests/e2e/helpers.ts).
    command: 'npm run dev',
    port: 3713,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: '3713',
    },
  },
});
