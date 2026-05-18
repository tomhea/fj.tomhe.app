import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

const execFileAsync = promisify(execFile);

// bf2fj <input.bf> -o <output.fj>
const BF2FJ_CMD = process.env.BF2FJ_CMD ?? 'bf2fj';
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 512 * 1024;

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
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
        error: e.message ?? 'BF conversion failed.',
        stderr: e.stderr ?? '',
      });
    }

    const fjContent = await readFile(outPath, 'utf8');
    return NextResponse.json({ success: true, fjContent, stderr });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  } finally {
    if (tempDir) rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
