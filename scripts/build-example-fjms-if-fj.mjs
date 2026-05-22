#!/usr/bin/env node
/**
 * Conditionally invoke `python scripts/build-example-fjms.py` if `fj` is on
 * PATH. The Python script needs the `flipjump` package (provides the `fj`
 * CLI), which is installed locally for most contributors but absent on the
 * GitHub Actions runner during `npm run build`.
 *
 * Used from `predev` so local `npm run dev` gets a working cache, but a
 * missing `fj` doesn't kill the dev server. ALWAYS exits 0 (intentional —
 * the cache is a best-effort optimisation).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

function which(cmd) {
  // PATH lookup that works on both Unix and Windows. Avoids shell:true.
  const pathSep = process.platform === 'win32' ? ';' : ':';
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')
    : [''];
  const dirs = (process.env.PATH ?? '').split(pathSep).filter(Boolean);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = `${dir}/${cmd}${ext}`;
      try {
        if (existsSync(candidate)) return candidate;
      } catch { /* ignore */ }
    }
  }
  return null;
}

const fjCmd = process.env.FJ_CMD ?? 'fj';
if (!which(fjCmd)) {
  process.stdout.write(
    `[build-example-fjms] \`${fjCmd}\` not on PATH — skipping. ` +
    `Examples will fall back to /api/compile.\n`,
  );
  process.exit(0);
}

const python = process.platform === 'win32' ? 'python' : 'python3';
const result = spawnSync(python, ['scripts/build-example-fjms.py'], {
  stdio: 'inherit',
});
if (result.error) {
  process.stdout.write(
    `[build-example-fjms] python launch failed (${result.error.message}) — skipping.\n`,
  );
  process.exit(0);
}
// Non-zero exit from the python script is logged but never propagated:
// the cache is best-effort.
if (result.status !== 0) {
  process.stdout.write(
    `[build-example-fjms] python exited ${result.status} — continuing.\n`,
  );
}
process.exit(0);
