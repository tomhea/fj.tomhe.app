import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';

const execAsync = promisify(exec);

// Override with C2FJ_CMD env var if c2fj has a different entry point.
// Expected interface: `c2fj <input.(c|zip)> -o <output.fj>`
const C2FJ_CMD = process.env.C2FJ_CMD ?? 'c2fj';
const TIMEOUT_MS = 120_000; // 2 minutes (C compilation is slower)
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Allowed file extensions inside a C project zip
const ALLOWED_C_EXTENSIONS = /\.(c|h|cpp|hpp|cc|hh|cxx|hxx|s|asm)$/i;

export async function POST(req: NextRequest) {
  let tempDir: string | null = null;

  try {
    const contentType = req.headers.get('content-type') ?? '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'Expected multipart/form-data.' }, { status: 400 });
    }

    const formData = await req.formData();
    const uploadedFile = formData.get('file') as File | null;

    if (!uploadedFile) {
      return NextResponse.json({ success: false, error: 'No file uploaded.' }, { status: 400 });
    }

    const bytes = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'File too large (max 10 MB).' }, { status: 400 });
    }

    tempDir = join(tmpdir(), `c2fj-${uuidv4()}`);
    await mkdir(tempDir, { recursive: true });

    const srcDir = join(tempDir, 'src');
    await mkdir(srcDir, { recursive: true });
    const outPath = join(tempDir, 'output.fj');

    const filename = uploadedFile.name.toLowerCase();
    let mainInputPath: string;

    if (filename.endsWith('.zip')) {
      // Extract zip into srcDir
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const entryName = entry.entryName.replace(/\\/g, '/');
        // Security: reject paths with traversal or disallowed extensions
        if (entryName.includes('../') || entryName.startsWith('/')) continue;
        if (!ALLOWED_C_EXTENSIONS.test(entryName)) continue;

        const destPath = join(srcDir, entryName);
        // Ensure parent dir exists
        const { dirname } = await import('path');
        await mkdir(dirname(destPath), { recursive: true });
        await writeFile(destPath, entry.getData());
      }
      mainInputPath = srcDir;
    } else if (filename.endsWith('.c') || filename.endsWith('.cpp')) {
      // Single C/C++ file
      mainInputPath = join(srcDir, uploadedFile.name);
      await writeFile(mainInputPath, buffer);
    } else {
      return NextResponse.json({ success: false, error: 'Upload a .c, .cpp, or .zip file.' }, { status: 400 });
    }

    const cmd = `${C2FJ_CMD} "${mainInputPath}" -o "${outPath}"`;

    let stderr = '';
    try {
      const result = await execAsync(cmd, { timeout: TIMEOUT_MS, cwd: tempDir });
      stderr = result.stderr;
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      return NextResponse.json({
        success: false,
        error: e.message ?? 'C conversion failed.',
        stderr: e.stderr ?? '',
      });
    }

    const fjContent = await readFile(outPath, 'utf8');
    return NextResponse.json({ success: true, fjContent, stderr });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  } finally {
    if (tempDir) rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
