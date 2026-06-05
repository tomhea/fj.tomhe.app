# Learn Web Development — through this codebase

This folder is a self-contained tutorial that teaches web development concepts using the source code of this IDE — and, in the final chapters, its sister documentation-site repo — as the running example. Every code snippet shown here is real code from a real project.

You don't need any prior web experience. Start at Chapter 1 and work through them in order.

---

## Chapters

| # | Title | What you'll learn |
|---|-------|-------------------|
| [1](01-html-css-js.md) | The Web: HTML, CSS & JavaScript | What browsers do; the HTML shell; CSS variables |
| [2](02-react-components.md) | React Components | Functions that return JSX; `'use client'`; dynamic imports |
| [3](03-props.md) | Props: Passing Data | How parents pass data and callbacks to children |
| [4](04-state.md) | State: Making Things Interactive | `useState`; updating arrays; the "never mutate" rule |
| [5](05-layout-styling.md) | Layout & Styling | Tailwind flexbox; CSS variables; responsive design |
| [6](06-effects.md) | Effects: Talking to the World | `useEffect`; localStorage; timers and cleanup |
| [7](07-api-routes.md) | API Routes: The Backend | `fetch()`; Next.js API routes; request-response cycle |
| [8](08-websockets.md) | WebSockets: Real-Time | Persistent connections; streaming stdout to the browser |
| [9](09-typescript.md) | TypeScript: Types & Interfaces | `interface`; optional props; union & discriminated-union types |
| [10](10-middleware-security.md) | Middleware & Security Headers | `middleware.ts`; CSP & security headers; validating untrusted input |
| [11](11-testing.md) | Testing: Vitest, Testing Library & Playwright | The testing pyramid; unit, component, E2E & accessibility tests |
| [12](12-static-sites.md) | Static Sites & Extending the Build | SSG vs a live server; Sphinx/MyST/Furo; build-lifecycle hooks |
| [13](13-seo.md) | SEO & the Semantic Web | `<meta>`/Open Graph/Twitter cards; JSON-LD; sitemaps & 404s |
| [14](14-shipping.md) | Shipping It: CI, Deploy & Automated Updates | GitHub Actions; build-as-a-test; rsync deploy; a submodule-bump bot |

> Chapters 12–14 step over to this IDE's sister project — the documentation site at [fjdocs.tomhe.app](https://fjdocs.tomhe.app) (repo `flipjump-docs`) — to show web concepts the IDE itself never needed.

---

## How to read these

- **On GitHub** — click any chapter link above. GitHub renders Markdown with syntax highlighting.
- **In VS Code** — open a `.md` file and press `Ctrl+Shift+V` (or `Cmd+Shift+V` on Mac) to open the preview pane.
- **In this repo** — the files live in `tutorial/`. They never appear on the website.
