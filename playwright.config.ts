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

  // Generous per-test timeout: freshSession() navigates twice + waits for
  // Monaco to mount; under CI memory pressure this can exceed the 30s default.
  timeout: 60_000,

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
    // Firefox and WebKit are opt-in: set ALL_BROWSERS=1 to include them.
    // Run in CI via .github/workflows/e2e-cross-browser.yml (weekly + manual).
    ...(process.env.ALL_BROWSERS ? [
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit',  use: { ...devices['Desktop Safari']  } },
    ] : []),
  ],

  webServer: {
    // In CI we run against the production build (pre-built by the workflow step
    // "Build Next.js app" that runs before Playwright). Production serving is
    // much faster than dev — no on-demand compilation — so Monaco's AMD loading
    // completes well within the 60 s per-test budget.
    //
    // Locally (non-CI) we reuse whatever server is already running (typically
    // `npm run dev`). If no server is up Playwright starts `npm start`, which
    // requires a prior `npm run build` — run that manually once if needed.
    command: process.env.CI ? 'npm start' : 'npm run dev',
    port: 3713,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: '3713',
      // Override any system HOSTNAME so the server always binds to localhost,
      // not to a container-specific hostname that Playwright can't reach.
      HOSTNAME: 'localhost',
    },
  },
});
