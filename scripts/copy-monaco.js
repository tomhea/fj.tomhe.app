/**
 * Postinstall script: copy Monaco Editor's prebuilt min/vs directory into
 * public/monaco-vs so the app can load Monaco from its own origin rather
 * than from the cdn.jsdelivr.net CDN.
 *
 * Why: @monaco-editor/react uses an AMD loader that fetches loader.js and
 * editor.main.js from the CDN at runtime. In CI (and offline environments)
 * the CDN can be unreachable or slow, causing the editor to never mount.
 * Self-hosting avoids the network dependency entirely.
 *
 * public/monaco-vs/ is gitignored — the files live in node_modules and are
 * regenerated on every `npm install` / `npm ci`.
 */

const { cpSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');

const src  = join(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs');
const dest = join(__dirname, '..', 'public', 'monaco-vs');

if (!existsSync(src)) {
  // monaco-editor might not be installed in all environments (e.g. a pure
  // server-only build). Skip silently rather than breaking `npm install`.
  console.log('copy-monaco: monaco-editor/min/vs not found — skipping.');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`copy-monaco: copied monaco-editor/min/vs → public/monaco-vs`);
