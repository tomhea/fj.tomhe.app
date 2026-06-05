# Chapter 11 — Testing: Vitest, Testing Library & Playwright

> **Previous:** [Chapter 10 — Middleware & Security](10-middleware-security.md) | **Next:** [Chapter 12 — Static Sites](12-static-sites.md)

---

How do you know the IDE still works after you change something? You *test* it — but not by clicking around by hand every time. This project has automated tests that run in seconds and fail loudly the moment behaviour breaks.

Tests come in layers, often drawn as a **pyramid**: many small, fast **unit tests** at the base; fewer **component tests** in the middle; and a handful of slow, realistic **end-to-end tests** at the top. This codebase has all three. Let's climb the pyramid.

---

## Unit tests with Vitest

A unit test checks one small piece of pure logic in isolation. The filename validator from Chapter 10 is perfect for this — give it inputs, assert the outputs:

```ts
// tests/safe-filename.test.ts
import { describe, it, expect } from 'vitest';
import { isSafeFilename } from '@/lib/safe-filename';

describe('isSafeFilename', () => {
  const cases: Array<[string, boolean]> = [
    ['main.fj', true],
    ['my-file.fj', false],       // dashes not allowed
    ['../etc/passwd.fj', false], // path traversal blocked
    ['CON.fj', false],           // Windows reserved name
  ];

  for (const [name, expected] of cases) {
    it(`${JSON.stringify(name)} → ${expected}`, () => {
      expect(isSafeFilename(name)).toBe(expected);
    });
  }
});
```

`describe` groups related tests; `it` is one test; `expect(...).toBe(...)` is the assertion. Looping over a table of `[input, expected]` pairs is a tidy way to cover dozens of cases at once. The test runner is **Vitest**, configured in `vitest.config.ts`:

```ts
// vitest.config.ts
test: {
  include: ['tests/**/*.test.{ts,tsx}'],
  exclude: ['tests/e2e/**', 'node_modules/**'],  // Playwright runs separately
  environment: 'node',
  setupFiles: ['tests/setup.ts'],
  globals: true,
},
```

---

## Component tests with Testing Library

The next layer up renders a real React component in a simulated browser and interacts with it. These use **@testing-library/react**, and each file opts into a browser-like DOM with a comment at the top:

```tsx
// tests/components/Toolbar.test.tsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from '@/components/Toolbar';

describe('Toolbar', () => {
  it('renders the FlipJump IDE logo', () => {
    render(<Toolbar {...makeProps()} />);
    expect(screen.getByText('FlipJump IDE')).toBeInTheDocument();
  });

  it('calls onCompile when Compile is clicked', () => {
    const onCompile = vi.fn();
    render(<Toolbar {...makeProps({ onCompile })} />);
    fireEvent.click(screen.getByTitle('Compile FJ → FJM'));
    expect(onCompile).toHaveBeenCalledOnce();
  });
});
```

The pattern: `render()` mounts the component, `screen.getBy…` finds elements the way a user would (by visible text or title), and `fireEvent` simulates a click. `vi.fn()` makes a fake callback so you can assert it was called — this is how you test that a button wired to the `onCompile` prop (Chapter 3) actually fires.

---

## End-to-end tests with Playwright

At the top of the pyramid, an **end-to-end** (E2E) test drives a *real* browser against the *real* running app — no mocks. This project uses **Playwright**:

```ts
// tests/e2e/hello-world.spec.ts
import { test, expect } from '@playwright/test';
import { freshSession, waitForTerminal, toolbarBtn } from './_helpers';

test('Compile → Run prints Hello, World! and exits 0', async ({ page }) => {
  await freshSession(page);
  await toolbarBtn(page, 'Compile and run FJ online');
  await waitForTerminal(page, /Hello, World!/);
  await waitForTerminal(page, /Process exited \(code 0\)/);
});
```

This actually opens the IDE, clicks Run, and waits for `Hello, World!` to stream into the terminal — exercising the whole stack from Chapter 7's API to Chapter 8's WebSocket. Playwright even starts the server for you:

```ts
// playwright.config.ts
webServer: {
  command: process.env.CI ? 'npm start' : 'npm run dev',
  port: 3713,
  reuseExistingServer: !process.env.CI,
},
```

---

## Accessibility tests

Playwright can also assert the app is usable by everyone. A dedicated suite runs **axe-core**, which scans the page for accessibility violations — missing labels, poor contrast, broken ARIA:

```ts
// tests/e2e/a11y.spec.ts
import AxeBuilder from '@axe-core/playwright';

test('main IDE page has no axe-detected violations', async ({ page }) => {
  await freshSession(page);
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .exclude('.monaco-editor')
    .analyze();
  expect(r.violations, JSON.stringify(r.violations, null, 2)).toEqual([]);
});
```

If a change introduces an a11y regression, this test turns red.

---

## Running them

The `package.json` scripts tie it together:

```bash
npm run test       # Vitest: unit + component tests
npm run typecheck  # tsc --noEmit — the TypeScript checks from Chapter 9
npm run lint       # eslint over app/, components/, lib/, middleware.ts
```

Note that `tests/middleware.test.ts` tests the security headers from Chapter 10 — it builds a request and asserts the CSP and other headers come back correct. Every layer you've learned in this tutorial has tests guarding it.

---

## Key takeaways

- Automated tests catch regressions in seconds; they're organised as a pyramid — many fast unit tests, fewer component tests, a few slow E2E tests.
- **Vitest** runs unit tests (`describe`/`it`/`expect`); a table of `[input, expected]` pairs covers many cases compactly.
- **Testing Library** renders components in a jsdom DOM; `render` + `screen.getBy…` + `fireEvent` + `vi.fn()` test behaviour the way a user experiences it.
- **Playwright** drives a real browser against the real app end-to-end, and starts the server itself; `@axe-core/playwright` adds automated accessibility checks.
- `npm run test`, `typecheck`, and `lint` are the three gates — and `middleware.test.ts` verifies Chapter 10's security headers.

---

> **Next:** [Chapter 12 — Static Sites](12-static-sites.md)
