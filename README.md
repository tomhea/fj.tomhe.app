# fj.tomhe.app

An online IDE for the [FlipJump](https://esolangs.org/wiki/FlipJump) esoteric
programming language. Write, compile, and run FJ programs in your browser.

## Stack

- Next.js 15 (App Router) + React 19
- Monaco editor with a custom FlipJump tokenizer
- Custom Node server (`server.ts`) hosting a WebSocket runner (`/ws/run`) for
  live stdout/stderr/stdin streaming
- API routes for `fj` (assemble), `bf2fj` (Brainfuck → FJ), and `c2fj`
  (C → FJ via RISC-V)

## Prerequisites

1. **Node.js ≥ 20.9** (see `engines` in `package.json`)
2. **FlipJump CLIs** — `pip install flipjump c2fj` puts `fj`, `bf2fj`, and
   `c2fj` on PATH.
3. **For `c2fj` only:** GNU `make` plus a RISC-V toolchain on PATH. Without
   these, the BF→FJ and assemble/run features still work; only the C→FJ
   import does not.

## Local dev

```bash
cp .env.example .env.local         # optional — defaults are fine for localhost
npm install
npm run dev                        # http://localhost:3000
```

The first run fetches the FlipJump standard library into `public/stl/`. Set
`GITHUB_TOKEN` to avoid GitHub API rate limits, or `FJ_STL_REF=<sha>` to pin
a specific upstream commit/tag.

## Production

```bash
npm ci
npm run build
npm start                          # honours $PORT and $HOSTNAME
```

Environment variables (see `.env.example`):

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `HOSTNAME` | `localhost` | HTTP listen address |
| `ALLOWED_ORIGINS` | (localhost + `https://fj.tomhe.app`) | Comma-separated WebSocket origin allowlist |
| `TRUST_PROXY` | _(unset)_ | Set to `1` when behind a reverse proxy that owns `X-Forwarded-For` |
| `API_RATE_LIMIT` | `20` | Max REST API requests per IP per 60 s window |
| `FJ_CMD` | `fj` | Path to the `fj` binary |
| `BF2FJ_CMD` | `bf2fj` | Path to the `bf2fj` binary |
| `C2FJ_CMD` | `c2fj` | Path to the `c2fj` binary |
| `FJ_STL_REF` | `master` | Upstream ref for the STL fetch script |

## Tests

```bash
npm test          # one-shot Vitest run
npm run test:watch
npm run typecheck
```

## Deploy

The `.github/workflows/deploy.yml` workflow installs deps, runs `next build`,
rsyncs the working tree to the host, then `ssh`s in to `npm ci --omit=dev &&
systemctl restart fj`. The host must have a systemd unit named `fj` running
`tsx server.ts` from `/var/www/fj`. Required GitHub secrets:

- `SSH_PRIVATE_KEY`
- `SSH_HOST`
- `SSH_USER`

## Project layout

```
app/
  api/{compile,bf2fj,c2fj}/route.ts  # HTTP endpoints — shell out to the CLIs
  layout.tsx · page.tsx              # Page shell (IDE is SSR-disabled)
components/
  IDE.tsx                            # Top-level state + WS client
  Toolbar.tsx · FileTree.tsx
  CodeEditor.tsx · Terminal.tsx
  DocsPanel.tsx · StlViewer.tsx
lib/
  safe-filename.ts                   # Filename allowlist (covered by tests)
  parse-markers.ts                   # stderr → Monaco markers
  share.ts                           # URL hash share encode/decode
  examples.ts · types.ts
server.ts                            # Custom Node server + WebSocket runner
scripts/fetch-stl.mjs                # Pulls public/stl/** from upstream
```
