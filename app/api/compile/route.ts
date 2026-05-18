import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

const FJ_CMD = process.env.FJ_CMD ?? 'fj';
const MAX_FILES = 20;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const COMPILE_TIMEOUT_MS = 60_000; // 60 seconds

function isSafeFilename(name: string): boolean {
  return /^[\w][\w. -]*\.fj$/i.test(name) && !name.includes('..');
}

export async function POST(req: NextRequest) {
  let tempDir: string | null = null;

  try {
    const body = await req.json() as {
      files: Array<{ name: string; content: string }>;
    };

    if (!Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json({ success: false, error: 'No files provided.' }, { status: 400 });
    }
    if (body.files.length > MAX_FILES) {
      return NextResponse.json({ success: false, error: `Too many files (max ${MAX_FILES}).` }, { status: 400 });
    }

    tempDir = join(tmpdir(), `fj-compile-${uuidv4()}`);
    await mkdir(tempDir, { recursive: true });

    const paths: string[] = [];
    for (const file of body.files) {
      if (!isSafeFilename(file.name)) {
        return NextResponse.json({ success: false, error: `Unsafe filename: ${file.name}` }, { status: 400 });
      }
      if (Buffer.byteLength(file.content) > MAX_FILE_BYTES) {
        return NextResponse.json({ success: false, error: `File too large: ${file.name}` }, { status: 400 });
      }
      const p = join(tempDir, file.name);
      await writeFile(p, file.content, 'utf8');
      paths.push(p);
    }

    const outPath = join(tempDir, 'program.fjm');
    const cmd = `${FJ_CMD} asm ${paths.map(p => `"${p}"`).join(' ')} -o "${outPath}"`;

    let stderr = '';
    try {
      const result = await execAsync(cmd, { timeout: COMPILE_TIMEOUT_MS, cwd: tempDir });
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
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  } finally {
    if (tempDir) rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
