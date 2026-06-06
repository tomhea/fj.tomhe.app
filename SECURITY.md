# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in fj.tomhe.app, please report it
privately. **Do not open a public issue for security problems.**

Email [flipjumpproject@gmail.com](mailto:flipjumpproject@gmail.com) with:

- a description of the vulnerability and its impact,
- the steps required to reproduce it, and
- any relevant logs, payloads, or proof-of-concept.

You can expect an initial response within a few days. We will keep you updated
as we investigate and work on a fix, and we will credit you in the release notes
unless you ask to remain anonymous.

## Scope

This project runs the FlipJump CLIs (`fj`, `bf2fj`, `c2fj`) as child processes
on the server and streams their I/O to the browser over a WebSocket (`/ws/run`),
plus four REST endpoints under `app/api/` (`compile`, `bf2fj`, `c2fj`,
`cached-compile`). Reports that are especially valuable include:

- command/argument injection or path traversal reaching the CLI shell-out,
- sandbox escapes or resource-exhaustion (CPU/memory/disk) via the runner,
- bypasses of the WebSocket origin allowlist or the API rate limiter,
- missing or misconfigured security headers, and
- any way to read or write files outside the intended workspace.

## Supported Versions

This project is deployed continuously from the `main` branch. Only the latest
deployed version is supported — please verify the issue against the current
`main` before reporting.
