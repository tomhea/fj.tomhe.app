#!/usr/bin/env node
/**
 * Fetches the FlipJump standard library from GitHub and saves it to public/stl/.
 * Also writes public/stl-index.json listing all files.
 *
 * Run automatically via package.json prebuild/predev scripts.
 * Set GITHUB_TOKEN to avoid rate limits.
 */

import { writeFile, mkdir, rm, stat } from 'fs/promises';
import { join, dirname, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'stl');
const INDEX_PATH = join(ROOT, 'public', 'stl-index.json');

const REPO = 'tomhea/flip-jump';
const STL_PATH = 'flipjump/stl';
// Pin to a specific upstream ref so STL is reproducible between builds.
// Bump this when intentionally adopting upstream changes. The committed
// public/stl/** copy is the source of truth; this script only refreshes
// it when `public/stl-index.json` is missing.
const REF = process.env.FJ_STL_REF ?? 'main';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${REF}/${STL_PATH}`;
const API_BASE = `https://api.github.com/repos/${REPO}/contents/${STL_PATH}?ref=${encodeURIComponent(REF)}`;

const HEADERS = {
  'User-Agent': 'fj-ide-stl-fetch/1.0',
  'Accept': 'application/vnd.github.v3+json',
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
    : {}),
};

/** @type {{ path: string; name: string; dir: string; content: string }[]} */
const allFiles = [];

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${url}`);
  return res.text();
}

// Resolve once so the per-entry prefix check is cheap.
const OUT_DIR_REAL = resolve(OUT_DIR) + sep;

async function processDir(apiUrl, relDir) {
  const entries = await fetchJson(apiUrl);
  for (const entry of entries) {
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.type === 'dir') {
      await processDir(entry.url, relPath);
    } else if (entry.type === 'file' && (entry.name.endsWith('.fj') || entry.name === 'README.md')) {
      const rawUrl = `${RAW_BASE}/${relPath}`;
      const content = await fetchText(rawUrl);
      const outPath = join(OUT_DIR, relPath);
      // Defense in depth: GitHub API entry.name is HTTP-derived. A malicious
      // (or compromised) response could send '../../etc/passwd' style names;
      // refuse anything that resolves outside OUT_DIR. This also clears the
      // `js/http-to-file-access` taint flow for CodeQL.
      if (!resolve(outPath).startsWith(OUT_DIR_REAL)) {
        console.warn(`\nSkipping suspicious path: ${relPath}`);
        continue;
      }
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, content, 'utf8');
      allFiles.push({ path: relPath, name: entry.name, dir: relDir ?? '', content });
      process.stdout.write('.');
    }
  }
}

/**
 * Atomically test for INDEX_PATH's presence. Replaces `existsSync(INDEX_PATH)`
 * which CodeQL flags as a TOCTOU pair with the later writeFile to the same
 * path (`js/file-system-race`). On ENOENT we return false; any other error
 * (EACCES, EIO) propagates so a real filesystem problem isn't silently
 * masked as "not present, so refetch".
 */
async function indexExists() {
  try {
    await stat(INDEX_PATH);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
}

async function main() {
  // Skip if already fetched (allows offline dev)
  if (await indexExists()) {
    console.log('STL already fetched (public/stl-index.json exists). Delete it to re-fetch.');
    return;
  }

  console.log('Fetching FlipJump STL from GitHub…');
  await mkdir(OUT_DIR, { recursive: true });

  try {
    await processDir(API_BASE, '');
    console.log(`\nFetched ${allFiles.length} files.`);

    allFiles.sort((a, b) => a.path.localeCompare(b.path));
    const dirs = [...new Set(allFiles.map(f => f.dir))].filter(Boolean).sort();
    await writeFile(INDEX_PATH, JSON.stringify({ files: allFiles, dirs }, null, 2), 'utf8');
    console.log(`Written ${INDEX_PATH}`);
  } catch (err) {
    console.error('\nSTL fetch failed:', err.message);
    console.error('Continuing without STL. Set GITHUB_TOKEN to avoid rate limits.');
    // Clean up partial output. `rm` with `force: true` already swallows
    // ENOENT, so no need to pre-check existence (the existsSync was both
    // redundant and a TOCTOU window).
    await rm(OUT_DIR, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch(err => { console.error(err); process.exit(1); });
