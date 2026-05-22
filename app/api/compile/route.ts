import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { isSafeFilename } from '@/lib/safe-filename';
import { sanitizeStderr } from '@/lib/sanitize-stderr';
import { acquireJob, releaseJob } from '@/lib/concurrency';

const execFileAsync = promisify(execFile);

const FJ_CMD = process.env.FJ_CMD ?? 'fj';
const MAX_FILES = 20;
const MAX_FILE_BYTES = 256 * 1024; // 256 KB per file
const MAX_TOTAL_BYTES = 2 * 1024 * 1024; // 2 MB aggregate
const COMPILE_TIMEOUT_MS = 60_000;
// Content-Length ceiling — reject oversize requests before Next.js buffers the body.
const MAX_BODY_BYTES = MAX_TOTAL_BYTES + 64 * 1024; // aggregate limit + JSON envelope headroom

export const runtime = 'nodejs';
export const maxDuration = 90;

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
    const body = (await req.json()) as {
      files: Array<{ name: string; content: string }>;
    };

    if (!Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided.' },
        { status: 400 },
      );
    }
    if (body.files.length > MAX_FILES) {
      return NextResponse.json(
        { success: false, error: `Too many files (max ${MAX_FILES}).` },
        { status: 400 },
      );
    }

    let total = 0;
    for (const file of body.files) {
      if (!isSafeFilename(file.name)) {
        return NextResponse.json(
          { success: false, error: `Unsafe filename: ${file.name}` },
          { status: 400 },
        );
      }
      const size = Buffer.byteLength(file.content);
      if (size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { success: false, error: `File too large: ${file.name}` },
          { status: 400 },
        );
      }
      total += size;
    }
    if (total > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Combined file size exceeds limit.' },
        { status: 400 },
      );
    }

    tempDir = join(tmpdir(), `fj-compile-${uuidv4()}`);
    await mkdir(tempDir, { recursive: true });

    const paths: string[] = [];
    for (const file of body.files) {
      const p = join(tempDir, file.name);
      await writeFile(p, file.content, 'utf8');
      paths.push(p);
    }

    const outPath = join(tempDir, 'program.fjm');
    let stderr = '';
    try {
      const result = await execFileAsync(
        FJ_CMD,
        ['--asm', '-o', outPath, ...paths],
        { timeout: COMPILE_TIMEOUT_MS, cwd: tempDir, maxBuffer: 4 * 1024 * 1024 },
      );
      stderr = result.stderr;
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      return NextResponse.json({
        success: false,
        error: 'Compilation failed.',
        stderr: sanitizeStderr(e.stderr ?? ''),
      });
    }

    const fjmBuffer = await readFile(outPath);
    const fjmBase64 = fjmBuffer.toString('base64');

    return NextResponse.json({ success: true, fjmBase64, stderr: sanitizeStderr(stderr) });
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