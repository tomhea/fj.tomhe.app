import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { isSafeFilename } from '@/lib/safe-filename';

const execFileAsync = promisify(execFile);

const FJ_CMD = process.env.FJ_CMD ?? 'fj';
const MAX_FILES = 20;
const MAX_FILE_BYTES = 256 * 1024; // 256 KB per file — see route segment config note
const MAX_TOTAL_BYTES = 2 * 1024 * 1024; // 2 MB aggregate
const COMPILE_TIMEOUT_MS = 60_000;

export const runtime = 'nodejs';
// Allow larger JSON bodies than the default 1 MB. Aggregate file size is
// further capped inside the handler.
export const maxDuration = 90;

export async function POST(req: NextRequest) {
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
    // Use execFile (no shell) — Windows paths with spaces / backslashes
    // are passed safely as argv. `fj --asm -o OUT FILES…` is the real CLI
    // surface for "assemble only, save FJM".
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
        error: e.message ?? 'Compilation failed.',
        stderr: e.stderr ?? '',
      });
    }

    const fjmBuffer = await readFile(outPath);
    const fjmBase64 = fjmBuffer.toString('base64');

    return NextResponse.json({ success: true, fjmBase64, stderr });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  } finally {
    if (tempDir) rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
