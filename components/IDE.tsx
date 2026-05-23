'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { zipSync, strToU8 } from 'fflate';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';
import Terminal from './Terminal';
import Toolbar from './Toolbar';
import DocsPanel from './DocsPanel';
import {
  FJFile,
  SourceFile,
  TerminalLine,
  CompileStatus,
  RunStatus,
  ServerMessage,
  MonacoMarker,
} from '@/lib/types';
import { Example } from '@/lib/examples';
import { parseMarkers } from '@/lib/parse-markers';
import { EXAMPLE_FJM_INDEX } from '@/lib/generated/example-fjm-index';
import { fingerprintFilesBrowser } from '@/lib/example-fjm-cache';

const EXAMPLE_FJ = `// FlipJump Hello World
// ----------------------
// The FlipJump language has a single instruction: f;j
//   - Flip the bit at address f
//   - Then jump to address j
//
// stl.* macros come from the FlipJump standard library.
// Modify the file and click "Run FJ" to execute.

stl.startup

stl.output_char 'H'
stl.output_char 'e'
stl.output_char 'l'
stl.output_char 'l'
stl.output_char 'o'
stl.output_char ','
stl.output_char ' '
stl.output_char 'W'
stl.output_char 'o'
stl.output_char 'r'
stl.output_char 'l'
stl.output_char 'd'
stl.output_char '!'
stl.output_char '\\n'     // newline
stl.loop                  // halt (loop to self)
`;

function makeDefaultFile(): FJFile {
  return { id: uuidv4(), name: 'main.fj', content: EXAMPLE_FJ };
}

let lineCounter = 0;
// Soft cap on terminal lines — long-running fj programs can emit MBs of
// output; rendering each line as a DOM div hangs the page well before
// the WS or fj actually stops. 5000 keeps things smooth and is enough
// to surface stderr + the last few seconds of stdout.
const MAX_TERMINAL_LINES = 5000;
function nextLineId() {
  return ++lineCounter;
}

function loadFromLocalStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveToLocalStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded */
  }
}

function buildInitialFiles(): { files: FJFile[]; activeId: string } {
  // Open files persist via localStorage only — the share-URL feature
  // (#share= / ?share=) was removed because it leaked code into history /
  // clipboards. Any leftover ?share= or #share= in the URL is ignored.
  const saved = loadFromLocalStorage<FJFile[]>('fj-ide-files');
  if (saved?.length) return { files: saved, activeId: saved[0].id };
  const def = makeDefaultFile();
  return { files: [def], activeId: def.id };
}

export default function IDE() {
  // Single source of truth — call buildInitialFiles ONCE so files and
  // activeFileId always reference the same generated UUIDs.
  const [initial] = useState(buildInitialFiles);
  const [files, setFiles] = useState<FJFile[]>(initial.files);
  const [activeFileId, setActiveFileId] = useState<string>(initial.activeId);
  const [sources, setSources] = useState<SourceFile[]>(
    () => loadFromLocalStorage<SourceFile[]>('fj-ide-sources') ?? [],
  );
  const [activeSourceIdx, setActiveSourceIdx] = useState<number | null>(null);
  const [compiledFjm, setCompiledFjm] = useState<string | null>(null);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [compileStatus, setCompileStatus] = useState<CompileStatus>('idle');
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [stdinContent, setStdinContent] = useState('');
  const [markers, setMarkers] = useState<MonacoMarker[]>([]);
  const [docsOpen, setDocsOpen] = useState(false);
  const [stlSearch, setStlSearch] = useState<string | undefined>(undefined);
  const [stlSearchTick, setStlSearchTick] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => loadFromLocalStorage<boolean>('fj-ide-sidebar-collapsed') ?? false,
  );
  // Mobile tab: which panel is active on narrow screens.
  // 'files'    → full-width file tree drawer
  // 'editor'   → code editor
  // 'terminal' → terminal output
  const [mobileTab, setMobileTab] = useState<'files' | 'editor' | 'terminal'>('editor');

  // True when the viewport is below Tailwind's md breakpoint (768 px).
  // Used to gate fillHeight and force-expand the file tree drawer.
  const [isMobileView, setIsMobileView] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const wsRef = useRef<WebSocket | null>(null);
  const runStartRef = useRef<number>(0);
  const compileAbortRef = useRef<AbortController | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const runAbortRef = useRef<AbortController | null>(null);

  // Persist on change.
  useEffect(() => {
    saveToLocalStorage('fj-ide-files', files);
  }, [files]);
  useEffect(() => {
    saveToLocalStorage('fj-ide-sources', sources);
  }, [sources]);
  useEffect(() => {
    saveToLocalStorage('fj-ide-sidebar-collapsed', sidebarCollapsed);
  }, [sidebarCollapsed]);

  // Cap the terminal at MAX_TERMINAL_LINES — keeps a program that prints
  // millions of lines from hanging the browser by exploding the DOM. The
  // banner only shows once when we first truncate.
  const addLine = useCallback((type: TerminalLine['type'], text: string) => {
    setTerminalLines((prev) => {
      const next = [...prev, { type, text, id: nextLineId() }];
      if (next.length > MAX_TERMINAL_LINES) {
        const dropped = next.length - MAX_TERMINAL_LINES;
        return [
          { type: 'info' as const, text: `… ${dropped} earlier line${dropped === 1 ? "" : "s"} truncated`, id: nextLineId() },
          ...next.slice(-MAX_TERMINAL_LINES + 1),
        ];
      }
      return next;
    });
  }, []);

  const clearTerminal = useCallback(() => setTerminalLines([]), []);

  // Active view: FJ file or source.
  const activeFile = files.find((f) => f.id === activeFileId) ?? files[0];
  const viewFile: FJFile | undefined =
    activeSourceIdx !== null && sources[activeSourceIdx]
      ? {
          id: `source-${activeSourceIdx}`,
          name: sources[activeSourceIdx].name,
          content: sources[activeSourceIdx].content,
        }
      : activeFile;
  const viewReadOnly = activeSourceIdx !== null;
  const viewLanguage =
    activeSourceIdx !== null
      ? sources[activeSourceIdx]?.type === 'bf'
        ? 'brainfuck'
        : 'c'
      : undefined;

  function selectFile(id: string) {
    setActiveFileId(id);
    setActiveSourceIdx(null);
  }

  function selectSource(idx: number) {
    setActiveSourceIdx(idx);
  }

  const updateFileContent = useCallback((id: string, content: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, content } : f)));
    setCompiledFjm(null);
    setMarkers([]);
  }, []);

  const createFile = useCallback((name: string) => {
    // FJ comments are `//`. `;` is the flip-jump separator and would be
    // parsed as a (broken) half-instruction.
    const f: FJFile = { id: uuidv4(), name, content: `// ${name}\n` };
    setFiles((prev) => [...prev, f]);
    setActiveFileId(f.id);
    setActiveSourceIdx(null);
  }, []);

  const renameFile = useCallback((id: string, name: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  }, []);

  const deleteFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        // Always keep at least one file — deleting the last file is a no-op.
        if (prev.length <= 1) return prev;
        const next = prev.filter((f) => f.id !== id);
        setActiveFileId((current) => (current === id ? next[0].id : current));
        return next;
      });
    },
    [],
  );

  const deleteSource = useCallback((idx: number) => {
    setSources((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
    setActiveSourceIdx((current) => {
      if (current === null) return null;
      if (current === idx) return null;          // deleted the active one
      if (current > idx) return current - 1;    // indices shifted
      return current;
    });
  }, []);

  const reorderFiles = useCallback((reordered: FJFile[]) => {
    setFiles(reordered);
  }, []);

  const importFjFiles = useCallback(
    (incoming: Array<{ name: string; content: string }>, replace = false) => {
      setFiles((prev) => {
        // replace=true (zip project import): discard existing files entirely.
        const base = replace ? [] : [...prev];
        const updated = [...base];
        let lastId = '';
        for (const inc of incoming) {
          const existing = updated.find((f) => f.name === inc.name);
          if (existing) {
            const idx = updated.indexOf(existing);
            updated[idx] = { ...existing, content: inc.content };
            lastId = existing.id;
          } else {
            const f: FJFile = { id: uuidv4(), name: inc.name, content: inc.content };
            updated.push(f);
            lastId = f.id;
          }
        }
        if (lastId) {
          setActiveFileId(lastId);
          setActiveSourceIdx(null);
        }
        // Never leave the editor with zero files (shouldn't happen, but guard anyway).
        if (updated.length === 0) {
          const fresh: FJFile = { id: uuidv4(), name: 'untitled.fj', content: '// untitled.fj\n' };
          setActiveFileId(fresh.id);
          return [fresh];
        }
        return updated;
      });
    },
    [],
  );

  const importSingleFj = useCallback(
    (name: string, content: string) => {
      importFjFiles([{ name, content }]);
    },
    [importFjFiles],
  );

  const loadExample = useCallback((ex: Example) => {
    const newFiles = ex.files.map((f) => ({ ...f, id: uuidv4() }));
    setFiles(newFiles);
    setActiveFileId(newFiles[0].id);
    setActiveSourceIdx(null);
    setCompiledFjm(null);
    setMarkers([]);
  }, []);

  const importFjm = useCallback(
    (base64: string) => {
      setCompiledFjm(base64);
      addLine('info', '↑ Loaded program.fjm');
    },
    [addLine],
  );

  // ── Compile ───────────────────────────────────────────────────────────────

  /**
   * Try the cached-compile fast path for built-in examples. Returns the
   * decoded server payload on a cache hit, null on miss / failure (caller
   * falls back to /api/compile). Snapshots files BEFORE hashing so an edit
   * mid-hash can't produce a stale-slug → fresh-content mismatch.
   */
  const tryCachedCompile = useCallback(
    async (
      snapshot: Array<{ name: string; content: string }>,
      signal: AbortSignal,
    ): Promise<{ fjmBase64: string; stderr: string } | null> => {
      try {
        const hash = await fingerprintFilesBrowser(snapshot);
        const entry = EXAMPLE_FJM_INDEX[hash];
        if (!entry) return null;
        const res = await fetch('/api/cached-compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ slug: entry.slug }),
          signal,
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          success: boolean;
          fjmBase64?: string;
          stderr?: string;
        };
        if (!data.success || !data.fjmBase64) return null;
        return { fjmBase64: data.fjmBase64, stderr: data.stderr ?? '' };
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        return null;
      }
    },
    [],
  );

  const doCompile = useCallback(async (): Promise<string | null> => {
    // Abort any in-flight compile — protects against stale-response races on
    // rapid Compile clicks.
    compileAbortRef.current?.abort();
    const ctrl = new AbortController();
    compileAbortRef.current = ctrl;

    clearTerminal();
    setCompileStatus('compiling');
    setMarkers([]);
    addLine('info', '⟶ Compiling…');

    // Immutable snapshot — any subsequent edit goes into a new array, so the
    // hash + the POST body stay consistent even if the user types between
    // the hash compute and the network call.
    const snapshot = files.map((f) => ({ name: f.name, content: f.content }));

    try {
      // Cache fast path — see lib/example-fjm-cache.ts. Hits /api/cached-compile;
      // on any failure (including hash miss) returns null and we fall through
      // to the real compile.
      const cached = await tryCachedCompile(snapshot, ctrl.signal);
      if (cached) {
        // Render the cached timing block as stdout (neutral light gray),
        // not stderr (red) — these lines are informational, not errors.
        // `trimEnd` only — preserve the leading "  " indent on the first
        // line so it column-aligns with the rest of the block.
        if (cached.stderr.trimEnd()) addLine('stdout', cached.stderr.trimEnd());
        setCompiledFjm(cached.fjmBase64);
        setCompileStatus('success');
        addLine('info', '✓ Compilation successful.');
        return cached.fjmBase64;
      }

      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ files: snapshot }),
        signal: ctrl.signal,
      });
      const data = (await res.json()) as {
        success: boolean;
        fjmBase64?: string;
        stderr?: string;
        error?: string;
      };

      if (data.stderr?.trimEnd()) {
        // Success path: the stderr is just `fj --asm`'s four phase-timing
        // lines (`parsing: 0.0…s`, …). Style those as stdout (neutral) so
        // they match the cached path and don't look alarming in red.
        // Failure path: the stderr contains the real compile error from
        // `fj` — keep that in the stderr lane (red) so it reads as an error.
        // `trimEnd` (not `trim`) preserves the leading `  ` indent on the
        // first line so the four lines column-align with `fj`'s output.
        // Sanitization (stripping Python traceback frames + server paths)
        // already happens server-side in /api/compile via sanitizeStderr.
        const lane = data.success ? 'stdout' : 'stderr';
        addLine(lane, data.stderr.trimEnd());
        setMarkers(parseMarkers(data.stderr));
      }

      if (data.success && data.fjmBase64) {
        setCompiledFjm(data.fjmBase64);
        setCompileStatus('success');
        addLine('info', '✓ Compilation successful.');
        return data.fjmBase64;
      } else {
        setCompileStatus('error');
        addLine('error', data.error ?? 'Compilation failed.');
        return null;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null;
      setCompileStatus('error');
      addLine('error', `Compilation error: ${(err as Error).message}`);
      return null;
    }
  }, [files, addLine, clearTerminal, tryCachedCompile]);

  const compile = useCallback(async () => {
    await doCompile();
  }, [doCompile]);

  // ── Download FJM ──────────────────────────────────────────────────────────

  const downloadFjm = useCallback(async () => {
    let fjm = compiledFjm;
    if (!fjm) {
      // doCompile clears the terminal itself
      fjm = await doCompile();
    } else {
      clearTerminal();
    }
    if (!fjm) return;

    const bytes = Uint8Array.from(atob(fjm), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program.fjm';
    a.click();
    URL.revokeObjectURL(url);
    addLine('info', '↓ Downloaded program.fjm');
  }, [compiledFjm, doCompile, addLine, clearTerminal]);

  // ── Download FJ Project ───────────────────────────────────────────────────

  const downloadFjProject = useCallback(() => {
    if (files.length === 1) {
      // Single file → direct download
      const blob = new Blob([files[0].content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = files[0].name;
      a.click();
      URL.revokeObjectURL(url);
      addLine('info', `↓ Downloaded ${files[0].name}`);
    } else {
      // Multiple files → zip with files_order.txt
      const order = files.map((f) => f.name).join('\n') + '\n';
      const zipInput: Record<string, Uint8Array> = {
        'files_order.txt': strToU8(order),
      };
      for (const f of files) {
        zipInput[f.name] = strToU8(f.content);
      }
      const zipped = zipSync(zipInput);
      const blob = new Blob([zipped], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fj-project.zip';
      a.click();
      URL.revokeObjectURL(url);
      addLine('info', `↓ Downloaded fj-project.zip (${files.length} files)`);
    }
  }, [files, addLine]);

  // ── Import BF ─────────────────────────────────────────────────────────────

  const importBf = useCallback(
    async (content: string, filename: string) => {
      setSources((prev) => {
        const existing = prev.findIndex((s) => s.name === filename && s.type === 'bf');
        const entry: SourceFile = { name: filename, type: 'bf', content };
        return existing >= 0
          ? prev.map((s, i) => (i === existing ? entry : s))
          : [...prev, entry];
      });
      clearTerminal();
      addLine('info', `⟶ Converting ${filename} via bf2fj…`);

      importAbortRef.current?.abort();
      const ctrl = new AbortController();
      importAbortRef.current = ctrl;

      try {
        const res = await fetch('/api/bf2fj', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ content }),
          signal: ctrl.signal,
        });
        const data = (await res.json()) as {
          success: boolean;
          fjContent?: string;
          stderr?: string;
          error?: string;
        };
        if (data.stderr?.trim()) addLine('stderr', data.stderr.trim());
        if (data.success && data.fjContent) {
          const name = filename.replace(/\.(bf|b)$/i, '.fj');
          importSingleFj(name, data.fjContent);
          addLine('info', `✓ Imported ${name}`);
        } else {
          addLine('error', data.error ?? 'BF conversion failed.');
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        addLine('error', `bf2fj error: ${(err as Error).message}`);
      }
    },
    [importSingleFj, addLine, clearTerminal],
  );

  // ── Import C ──────────────────────────────────────────────────────────────

  const importC = useCallback(
    async (formData: FormData) => {
      const file = formData.get('file') as File;
      const isZip = file?.name.endsWith('.zip');
      if (file) {
        const content = isZip ? '(zip archive)' : await file.text();
        setSources((prev) => {
          const entry: SourceFile = { name: file.name, type: 'c', content };
          const existing = prev.findIndex((s) => s.name === file.name && s.type === 'c');
          return existing >= 0
            ? prev.map((s, i) => (i === existing ? entry : s))
            : [...prev, entry];
        });
      }
      clearTerminal();
      addLine('info', `⟶ Converting ${file?.name ?? 'C project'} to a .fj file, via c2fj…`);

      importAbortRef.current?.abort();
      const ctrl = new AbortController();
      importAbortRef.current = ctrl;

      try {
        const res = await fetch('/api/c2fj', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: formData,
          signal: ctrl.signal,
        });
        const data = (await res.json()) as {
          success: boolean;
          fjContent?: string;
          stderr?: string;
          error?: string;
        };
        if (data.stderr?.trim()) addLine('stderr', data.stderr.trim());
        if (data.success && data.fjContent) {
          // Store the generated FJ in the source entry rather than opening it
          // in the editor — c2fj output can be very large and would freeze
          // Monaco.  The Toolbar surfaces a "Run C Output" button instead.
          setSources((prev) =>
            prev.map((s) =>
              s.name === file?.name && s.type === 'c'
                ? { ...s, fjOutput: data.fjContent! }
                : s,
            ),
          );
          addLine('info', '✓ C→FJ complete. Click "Run C→FJ output" in the toolbar to execute the FJ file.');
        } else {
          addLine('error', data.error ?? 'C conversion failed.');
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        addLine('error', `c2fj error: ${(err as Error).message}`);
      }
    },
    [addLine, clearTerminal],
  );

  // ── WebSocket Runner ──────────────────────────────────────────────────────

  const killProcess = useCallback(() => {
    // Abort any in-flight cached-compile fetch BEFORE the WS connects, so a
    // mid-fetch Kill click doesn't leave the request running invisibly.
    runAbortRef.current?.abort();
    wsRef.current?.send(JSON.stringify({ type: 'kill' }));
  }, []);

  const runOnline = useCallback(
    async (mode: 'fj' | 'fjm', filesOverride?: Array<{ name: string; content: string }>) => {
      if (runStatus === 'running') return;

      clearTerminal();
      setRunStatus('running');

      // Snapshot the file list NOW so an edit mid-flight can't desync the
      // hash from the bytes we send. The c2fj / runC2fjSource path passes
      // its own filesOverride, which we pass through unchanged.
      const snapshot: Array<{ name: string; content: string }> =
        filesOverride ?? files.map((f) => ({ name: f.name, content: f.content }));

      // Cache fast path for Run FJ. If the snapshot hashes to a known
      // example, fetch the pre-built .fjm and feed it into the existing
      // run_fjm WS message. Any failure → fall through to run_fj.
      // Wired through runAbortRef so killProcess can cancel the fetch.
      runAbortRef.current?.abort();
      const runCtrl = new AbortController();
      runAbortRef.current = runCtrl;
      let cachedFjmBase64: string | null = null;
      let cachedStderr = '';
      if (mode === 'fj') {
        try {
          const cached = await tryCachedCompile(snapshot, runCtrl.signal);
          if (cached) {
            cachedFjmBase64 = cached.fjmBase64;
            cachedStderr = cached.stderr;
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') {
            setRunStatus('idle');
            return;
          }
          // Anything else: log and fall through to the real run_fj path.
          console.warn('[run] cached-compile failed:', err);
        }
      }

      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProto}//${window.location.host}/ws/run`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mode === 'fjm' && compiledFjm) {
          addLine('info', '⟶ Running compiled FJM…');
          ws.send(
            JSON.stringify({
              type: 'run_fjm',
              fjmBase64: compiledFjm,
              initialStdin: stdinContent || undefined,
            }),
          );
        } else if (cachedFjmBase64) {
          // Render the cache flow identically to a fresh compile from the
          // user's POV: same "⟶ Compiling and running…" banner, same neutral
          // (stdout) styling for the four timing lines. `trimEnd` only —
          // preserve the two-space indent on the first line.
          addLine('info', '⟶ Compiling and running…');
          if (cachedStderr.trimEnd()) addLine('stdout', cachedStderr.trimEnd());
          // Surface the compiled .fjm to client state so the Run FJM button
          // appears once the run completes. The uncached path gets the same
          // via the `fjm_compiled` WS message in ws.onmessage above.
          setCompiledFjm(cachedFjmBase64);
          ws.send(
            JSON.stringify({
              type: 'run_fjm',
              fjmBase64: cachedFjmBase64,
              initialStdin: stdinContent || undefined,
            }),
          );
        } else {
          addLine('info', '⟶ Compiling and running…');
          ws.send(
            JSON.stringify({
              type: 'run_fj',
              files: snapshot,
              initialStdin: stdinContent || undefined,
            }),
          );
        }
      };

      // Stream a raw chunk into the terminal.
      // Chunks are appended to the current partial line; a new line is only
      // started when a \n is encountered — so "Hel" + "lo\n" renders as one
      // line "Hello", not two separate divs.
      function streamChunk(type: 'stdout' | 'stderr', chunk: string) {
        // Normalise \r\n and bare \r so fj's progress/timing output doesn't
        // bleed raw carriage-returns into the display.
        const text = chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const parts = text.split('\n');

        setTerminalLines((prev) => {
          let lines = [...prev];
          const last = lines[lines.length - 1];

          // First part: append to existing partial line of the same type,
          // or start a new partial line.
          if (last?.partial && last.type === type) {
            lines[lines.length - 1] = { ...last, text: last.text + parts[0] };
          } else {
            lines.push({ type, text: parts[0], id: nextLineId(), partial: true });
          }

          // Each subsequent part follows a \n: terminate the current line and
          // open a new partial one (skip adding a trailing empty part so a
          // final \n doesn't leave a dangling blank line).
          for (let i = 1; i < parts.length; i++) {
            lines[lines.length - 1] = { ...lines[lines.length - 1], partial: false };
            const isTrailing = i === parts.length - 1 && parts[i] === '';
            if (!isTrailing) {
              lines.push({ type, text: parts[i], id: nextLineId(), partial: i === parts.length - 1 });
            }
          }

          if (lines.length > MAX_TERMINAL_LINES) {
            const dropped = lines.length - MAX_TERMINAL_LINES;
            return [
              { type: 'info' as const, text: `… ${dropped} earlier line${dropped === 1 ? '' : 's'} truncated`, id: nextLineId() },
              ...lines.slice(-MAX_TERMINAL_LINES + 1),
            ];
          }
          return lines;
        });
      }

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as ServerMessage;
        switch (msg.type) {
          case 'started':
            runStartRef.current = Date.now();
            break;
          case 'stdout':
            streamChunk('stdout', msg.data);
            break;
          case 'stderr':
            streamChunk('stderr', msg.data);
            break;
          case 'exit': {
            // Terminate any still-partial lines left by a program that didn't
            // end its output with \n.
            setTerminalLines((prev) =>
              prev[prev.length - 1]?.partial
                ? [...prev.slice(0, -1), { ...prev[prev.length - 1], partial: false }]
                : prev,
            );
            const elapsed = ((Date.now() - runStartRef.current) / 1000).toFixed(2);
            addLine(
              'info',
              msg.code === 0
                ? `✓ Process exited (code 0) — ${elapsed}s`
                : `Process exited with code ${msg.code ?? '?'} — ${elapsed}s`,
            );
            setRunStatus('exited');
            wsRef.current = null;
            break;
          }
          case 'fjm_compiled':
            // Sent by the server after a successful Run FJ. Store the
            // compiled .fjm so the Toolbar's Run FJM button becomes
            // visible and the user can re-run without recompiling.
            setCompiledFjm(msg.fjmBase64);
            break;
          case 'error':
            addLine('error', msg.data);
            setRunStatus('error');
            wsRef.current = null;
            break;
        }
      };

      ws.onerror = () => {
        addLine('error', 'WebSocket connection failed.');
        setRunStatus('error');
        wsRef.current = null;
      };

      ws.onclose = () => {
        setRunStatus((s) => (s === 'running' ? 'exited' : s));
        wsRef.current = null;
      };
    },
    [runStatus, compiledFjm, files, stdinContent, clearTerminal, addLine, tryCachedCompile],
  );

  const sendStdin = useCallback(
    (input: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stdin', stdin: input }));
        addLine('info', `> ${input.trimEnd()}`);
      }
    },
    [addLine],
  );

  /**
   * Run the FJ output produced by the most-recent C→FJ conversion directly,
   * bypassing the editor.  Used when the generated file is too large for Monaco.
   */
  const runC2fjSource = useCallback(() => {
    const src = sources.find((s) => s.type === 'c' && s.fjOutput);
    if (src?.fjOutput) {
      runOnline('fj', [{ name: 'output.fj', content: src.fjOutput }]);
    }
  }, [sources, runOnline]);

  // Non-null when there's a pending c2fj result that can be run directly.
  const c2fjOutput = sources.find((s) => s.type === 'c' && s.fjOutput)?.fjOutput ?? null;

  // On mobile, automatically reveal the terminal tab when a run starts so the
  // user doesn't have to manually switch to see output.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (runStatus === 'running') setMobileTab('terminal');
  }, [runStatus]);

  // First-visit hint: surface a non-noisy nudge in the terminal instead of
  // auto-running. The previous auto-run was confusing on networks where
  // /ws/run is blocked (corp proxies) and surprising in general.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('fj-visited')) {
      localStorage.setItem('fj-visited', '1');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      addLine('info', '👋  Click "Run FJ" in the toolbar to try the sample program.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tear down WS and in-flight requests on unmount.
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      compileAbortRef.current?.abort();
      importAbortRef.current?.abort();
      runAbortRef.current?.abort();
    };
  }, []);

  const isRunning = runStatus === 'running';

  // On mobile, 'Hide Explorer' button exits back to editor.
  const handleToggleSidebar = () => {
    if (isMobileView) setMobileTab('editor');
    else setSidebarCollapsed((c) => !c);
  };

  return (
    // .ide-root applies safe-area padding (iPhone home-indicator / notch).
    // Height comes from the parent flex container in app/page.tsx — see the
    // `flex-1 min-h-0` wrapper there.
    <div
      className="ide-root flex flex-col flex-1 min-h-0"
      style={{ background: '#1e1e1e', overflow: 'hidden' }}
    >
      <header>
        {/* Visually-hidden page title so screen readers and axe have an h1 landmark. */}
        <h1 className="sr-only">FlipJump IDE</h1>
        <Toolbar
          compileStatus={compileStatus}
          runStatus={runStatus}
          compiledFjm={compiledFjm}
          onCompile={compile}
          onDownloadFjm={downloadFjm}
          onDownloadFjProject={downloadFjProject}
          onRunFj={() => runOnline('fj')}
          onRunFjm={() => runOnline('fjm')}
          onKill={killProcess}
          onImportBf={importBf}
          onImportC={importC}
          onImportFj={importFjFiles}
          onImportError={(msg) => addLine('error', msg)}
          onImportFjm={importFjm}
          onLoadExample={loadExample}
          onOpenDocs={() => { setStlSearch(undefined); setDocsOpen(true); }}
          c2fjOutput={c2fjOutput}
          onRunC2fjSource={runC2fjSource}
        />
      </header>

      {/* ── Main content area ─────────────────────────────────────────── */}
      <main className="flex flex-1 min-h-0">

        {/* ── File tree ─────────────────────────────────────────────────
            Desktop (md+): always visible as a fixed-width sidebar.
            Mobile: only visible when the 'files' tab is active, fills
            the entire main area at full width.                        */}
        <div className={
          mobileTab === 'files'
            ? 'flex flex-col flex-1 min-h-0 md:flex md:flex-none md:flex-col'
            : 'hidden md:flex md:flex-none md:flex-col'
        }>
          <FileTree
            files={files}
            activeFileId={activeFileId}
            sources={sources}
            activeSourceIdx={activeSourceIdx}
            collapsed={isMobileView ? false : sidebarCollapsed}
            onToggleCollapsed={handleToggleSidebar}
            fullWidth={isMobileView}
            onSelectFile={(id) => { selectFile(id); setMobileTab('editor'); }}
            onSelectSource={(idx) => { selectSource(idx); setMobileTab('editor'); }}
            onCreateFile={createFile}
            onRenameFile={renameFile}
            onDeleteFile={deleteFile}
            onDeleteSource={deleteSource}
            onReorderFiles={reorderFiles}
          />
        </div>

        {/* ── Editor + Terminal column ───────────────────────────────────
            Desktop (md+): always visible, fills remaining width.
            Mobile: hidden while the files tab is showing.            */}
        <div className={
          mobileTab === 'files'
            ? 'hidden md:flex md:flex-col md:flex-1 md:min-w-0 md:min-h-0'
            : 'flex flex-col flex-1 min-w-0 min-h-0'
        }>
          {/* Editor panel
              Desktop: always flex-1 (fills above the terminal).
              Mobile: only shown for the editor tab.                  */}
          <div className={
            mobileTab === 'editor'
              ? 'flex flex-col flex-1 min-h-0 md:flex md:flex-col md:flex-1 md:min-h-0'
              : 'hidden md:flex md:flex-col md:flex-1 md:min-h-0'
          }>
            <CodeEditor
              file={viewFile}
              onChange={(content) => {
                if (activeSourceIdx === null && activeFile) {
                  updateFileContent(activeFile.id, content);
                }
              }}
              markers={markers}
              readOnly={viewReadOnly}
              overrideLanguage={viewLanguage}
              onCtrlClick={(word) => {
                // Search for the macro definition so the STL viewer jumps to `def <word>`.
                setStlSearch(`def ${word}`);
                setStlSearchTick(t => t + 1); // always increments so repeated clicks re-arm auto-select
                setDocsOpen(true);
              }}
            />
          </div>

          {/* Terminal panel
              Desktop: always shown at its own managed height (flex-none).
              Mobile: only shown for the terminal tab, fills all space.  */}
          <div className={
            mobileTab === 'terminal'
              ? 'flex flex-col flex-1 min-h-0 md:flex md:flex-none md:flex-col md:min-h-0'
              : 'hidden md:flex md:flex-none md:flex-col md:min-h-0'
          }>
            <Terminal
              lines={terminalLines}
              runStatus={runStatus}
              onSendStdin={sendStdin}
              onClear={clearTerminal}
              onKill={killProcess}
              stdinContent={stdinContent}
              onStdinContentChange={setStdinContent}
              fillHeight={isMobileView && mobileTab === 'terminal'}
            />
          </div>
        </div>
      </main>

      {/* ── Mobile bottom tab bar (hidden on md+) ─────────────────────── */}
      <nav
        className="flex md:hidden shrink-0 border-t"
        style={{ background: '#252526', borderColor: '#3c3c3c' }}
        aria-label="Panel switcher"
      >
        <MobileTabBtn
          active={mobileTab === 'files'}
          onClick={() => setMobileTab('files')}
          icon={<FilesIcon />}
          label="Files"
        />
        <MobileTabBtn
          active={mobileTab === 'editor'}
          onClick={() => setMobileTab('editor')}
          icon={<EditorIcon />}
          label="Editor"
        />
        <MobileTabBtn
          active={mobileTab === 'terminal'}
          onClick={() => setMobileTab('terminal')}
          icon={<TerminalIcon active={isRunning} />}
          label={isRunning ? 'Running…' : 'Terminal'}
          badge={isRunning}
        />
      </nav>

      <DocsPanel open={docsOpen} onClose={() => setDocsOpen(false)} initialStlSearch={stlSearch} initialStlSearchTick={stlSearchTick} />
    </div>
  );
}

// ── Mobile bottom-tab helpers ─────────────────────────────────────────────────

function MobileTabBtn({
  active, onClick, icon, label, badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center flex-1 gap-0.5 py-2 text-xs relative"
      style={{
        color: active ? '#4fc1ff' : '#888',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        minHeight: 52, // 52px tall — comfortable touch target
      }}
    >
      {badge && (
        <span
          className="absolute top-1.5 right-[calc(50%-10px)] w-2 h-2 rounded-full"
          style={{ background: '#73c991' }}
        />
      )}
      {icon}
      <span style={{ fontWeight: active ? 600 : 400 }}>{label}</span>
      {active && (
        <span
          className="absolute top-0 left-4 right-4 h-0.5 rounded-full"
          style={{ background: '#4fc1ff' }}
        />
      )}
    </button>
  );
}

function FilesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 2h6l3 3v9H3V2z" strokeLinejoin="round" />
      <path d="M9 2v3h3" />
      <path d="M6 7h4M6 10h3" strokeLinecap="round" />
    </svg>
  );
}

function EditorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4l3 4-3 4M9 12h4" />
    </svg>
  );
}

function TerminalIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="2" width="14" height="12" rx="1.5" />
      <path d="M4 6l3 2-3 2" strokeLinecap="round" strokeLinejoin="round"
        style={{ stroke: active ? '#73c991' : 'currentColor' }} />
      <path d="M9 10h3" strokeLinecap="round" />
    </svg>
  );
}
