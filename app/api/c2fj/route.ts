import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { join, dirname, basename, resolve, sep } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';
import { isSafeCFilename } from '@/lib/safe-filename';

const execFileAsync = promisify(execFile);

// c2fj --build-dir <dir> --unify-fj --finish-after fj <source>
// Produces <dir>/unified.fj. Real c2fj requires `make` + the RISC-V toolchain
// on PATH — see README for deployment notes.
const C2FJ_CMD = process.env.C2FJ_CMD ?? 'c2fj';
const TIMEOUT_MS = 120_000;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // compressed
const MAX_DECOMPRESSED_TOTAL = 30 * 1024 * 1024;
const MAX_DECOMPRESSED_ENTRY = 5 * 1024 * 1024;

const ALLOWED_C_EXTENSIONS = /\.(c|h|cpp|hpp|cc|hh|cxx|hxx|s|asm)$/i;

// Unix mode upper nibble for symlinks in zip external attrs.
const SYMLINK_MODE = 0xa;

export const runtime = 'nodejs';
export const maxDuration = 150;

export async function POST(req: NextRequest) {
  let tempDir: string | null = null;

  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Expected multipart/form-data.' },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const uploadedFile = formData.get('file') as File | null;
    if (!uploadedFile) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded.' },
        { status: 400 },
      );
    }

    const bytes = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File too large (max 10 MB).' },
        { status: 400 },
      );
    }

    tempDir = join(tmpdir(), `c2fj-${uuidv4()}`);
    await mkdir(tempDir, { recursive: true });
    const srcDir = join(tempDir, 'src');
    const buildDir = join(tempDir, 'build');
    await mkdir(srcDir, { recursive: true });
    await mkdir(buildDir, { recursive: true });

    // Sanitize uploaded filename — multipart name is attacker-controlled.
    const safeName = basename(uploadedFile.name);
    const lower = safeName.toLowerCase();

    let inputForC2fj: string;
    if (lower.endsWith('.zip')) {
      // Extract zip into srcDir with zip-slip + zip-bomb + symlink protection.
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const srcDirReal = resolve(srcDir) + sep;
      let totalExtracted = 0;
      let extracted = 0;

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        // Skip symlinks (Unix-mode entries with the symlink bit).
        if ((entry.attr >>> 28) === SYMLINK_MODE) continue;

        const entryName = entry.entryName.replace(/\\/g, '/');
        if (!ALLOWED_C_EXTENSIONS.test(entryName)) continue;

        const destPath = join(srcDir, entryName);
        // Resolved-prefix check catches absolute paths (Windows drive letters,
        // UNC), `..` segments, and anything else that breaks out of srcDir.
        const destReal = resolve(destPath);
        if (!destReal.startsWith(srcDirReal)) continue;

        const uncompressed = entry.header.size;
        if (uncompressed > MAX_DECOMPRESSED_ENTRY) continue;
        totalExtracted += uncompressed;
        if (totalExtracted > MAX_DECOMPRESSED_TOTAL) {
          return NextResponse.json(
            { success: false, error: 'Archive too large when uncompressed.' },
            { status: 400 },
          );
        }

        await mkdir(dirname(destPath), { recursive: true });
        await writeFile(destPath, entry.getData());
        extracted++;
      }

      if (extracted === 0) {
        return NextResponse.json(
          { success: false, error: 'No supported source files found in archive.' },
          { status: 400 },
        );
      }

      // Heuristic: pick the first .c / .cc / .cpp at the top of srcDir as the
      // c2fj input; if none, take the first such file at any depth.
      const allFiles: string[] = [];
      const walk = async (dir: string): Promise<void> => {
        const { readdir } = await import('fs/promises');
        const items = await readdir(dir, { withFileTypes: true });
        for (const item of items) {
          const p = join(dir, item.name);
          if (item.isDirectory()) await walk(p);
          else allFiles.push(p);
        }
      };
      await walk(srcDir);
      const main =
        allFiles.find((p) => /\.(c|cc|cpp)$/i.test(p) && dirname(p) === srcDir) ??
        allFiles.find((p) => /\.(c|cc|cpp)$/i.test(p));
      if (!main) {
        return NextResponse.json(
          { success: false, error: 'No .c / .cc / .cpp file in archive.' },
          { status: 400 },
        );
      }
      inputForC2fj = main;
    } else if (isSafeCFilename(safeName)) {
      inputForC2fj = join(srcDir, safeName);
      await writeFile(inputForC2fj, buffer);
    } else {
      return NextResponse.json(
        { success: false, error: 'Upload a .c, .cpp, .h, or .zip file.' },
        { status: 400 },
      );
    }

    let stderr = '';
    try {
      const result = await execFileAsync(
        C2FJ_CMD,
        ['--build-dir', buildDir, '--unify-fj', '--finish-after', 'fj', inputForC2fj],
        { timeout: TIMEOUT_MS, cwd: tempDir, maxBuffer: 8 * 1024 * 1024 },
      );
      stderr = result.stderr;
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      return NextResponse.json({
        success: false,
        error: e.message ?? 'C conversion failed.',
        stderr: e.stderr ?? '',
      });
    }

    // c2fj writes unified.fj into the build dir when --unify-fj is set.
    const outPath = join(buildDir, 'unified.fj');
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
