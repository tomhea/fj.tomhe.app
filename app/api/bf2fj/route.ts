import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

import { sanitizeStderr } from '@/lib/sanitize-stderr';
import { acquireJob, releaseJob } from '@/lib/concurrency';

const execFileAsync = promisify(execFile);

const BF2FJ_CMD = process.env.BF2FJ_CMD ?? 'bf2fj';
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 512 * 1024;
// Content-Length ceiling — reject oversize requests before Next.js buffers the body.
const MAX_BODY_BYTES = MAX_BYTES + 64 * 1024; // content limit + JSON envelope headroom

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // CSRF: require a non-simple header so cross-origin form/fetch sends a preflight.
  if (!req.headers.get('x-requested-with')) {
    return NextResponse.json(
      { success: false, error: 'Missing X-Requested-With header.' },
      { status: 400 },
    );
  }

  // Reject oversize requests before buffering the body.
  const cl = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (!isNaN(cl) && cl > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Request too large.' },
      { status: 413 },
    );
  }

  if (!acquireJob()) {
    return NextResponse.json(
      { success: false, error: 'Server busy. Try again shortly.' },
      { status: 503 },
    );
  }

  let tempDir: string | null = null;

  try {
    const body = (await req.json()) as { content: string };

    if (!body.content) {
      return NextResponse.json(
        { success: false, error: 'No BF content provided.' },
        { status: 400 },
      );
    }
    if (Buffer.byteLength(body.content) > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File too large (max 512 KB).' },
        { status: 400 },
      );
    }

    tempDir = join(tmpdir(), `bf2fj-${uuidv4()}`);
    await mkdir(tempDir, { recursive: true });

    const inPath = join(tempDir, 'input.bf');
    const outPath = join(tempDir, 'output.fj');
    await writeFile(inPath, body.content, 'utf8');

    let stderr = '';
    try {
      const result = await execFileAsync(
        BF2FJ_CMD,
        [inPath, '-o', outPath],
        { timeout: TIMEOUT_MS, cwd: tempDir, maxBuffer: 4 * 1024 * 1024 },
      );
      stderr = result.stderr;
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      return NextResponse.json({
        success: false,
        error: 'BF conversion failed.',
        stderr: sanitizeStderr(e.stderr ?? ''),
      });
    }

    const fjContent = await readFile(outPath, 'utf8');
    return NextResponse.json({ success: true, fjContent, stderr: sanitizeStderr(stderr) });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  } finally {
    releaseJob();
    if (tempDir) rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}