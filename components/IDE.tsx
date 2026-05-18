'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
import { encodeShare, decodeShare } from '@/lib/share';
import { parseMarkers } from '@/lib/parse-markers';

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
stl.output_char 10        // newline
stl.loop                  // halt (loop to self)
`;

function makeDefaultFile(): FJFile {
  return { id: uuidv4(), name: 'main.fj', content: EXAMPLE_FJ };
}

let lineCounter = 0;
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

// Reads either `#share=…` (preferred — hash isn't sent in HTTP requests, so
// shared programs don't end up in server access logs or Referer headers) or
// the legacy `?share=…` query param so old links keep working.
function readShareParam(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (hash.startsWith('#share=')) return decodeURIComponent(hash.slice('#share='.length));
  const params = new URLSearchParams(window.location.search);
  return params.get('share');
}

function buildInitialFiles(): { files: FJFile[]; activeId: string } {
  const shared = readShareParam();
  if (shared) {
    const decoded = decodeShare(shared);
    if (decoded) {
      const files = decoded.map((f) => ({ ...f, id: uuidv4() }));
      return { files, activeId: files[0].id };
    }
  }
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
  const wsRef = useRef<WebSocket | null>(null);
  const runStartRef = useRef<number>(0);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compileAbortRef = useRef<AbortController | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);

  // Persist on change.
  useEffect(() => {
    saveToLocalStorage('fj-ide-files', files);
  }, [files]);
  useEffect(() => {
    saveToLocalStorage('fj-ide-sources', sources);
  }, [sources]);

  // Update the share fragment (debounced 1s). Written to hash, not query
  // string, so the encoded program doesn't leak into Referer / server logs.
  useEffect(() => {
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    shareTimerRef.current = setTimeout(() => {
      const encoded = encodeShare(files);
      if (encoded.length < 200_000) {
        const url = new URL(window.location.href);
        url.hash = `share=${encoded}`;
        url.searchParams.delete('share'); // drop legacy query if present
        window.history.replaceState(null, '', url.toString());
      }
    }, 1000);
    return () => {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    };
  }, [files]);

  const addLine = useCallback((type: TerminalLine['type'], text: string) => {
    setTerminalLines((prev) => [...prev, { type, text, id: nextLineId() }]);
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
        if (prev.length <= 1) {
          addLine('error', "Can't delete the last file.");
          return prev;
        }
        const next = prev.filter((f) => f.id !== id);
        setActiveFileId((current) => (current === id ? next[0].id : current));
        return next;
      });
    },
    [addLine],
  );

  const importFjFiles = useCallback(
    (incoming: Array<{ name: string; content: string }>) => {
      setFiles((prev) => {
        const updated = [...prev];
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

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
  }, []);

  // ── Compile ───────────────────────────────────────────────────────────────

  const doCompile = useCallback(async (): Promise<string | null> => {
    // Abort any in-flight compile — protects against stale-response races on
    // rapid Compile clicks.
    compileAbortRef.current?.abort();
    const ctrl = new AbortController();
    compileAbortRef.current = ctrl;

    setCompileStatus('compiling');
    setMarkers([]);
    addLine('info', '⟶ Compiling…');
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: files.map((f) => ({ name: f.name, content: f.content })),
        }),
        signal: ctrl.signal,
      });
      const data = (await res.json()) as {
        success: boolean;
        fjmBase64?: string;
        stderr?: string;
        error?: string;
      };

      if (data.stderr?.trim()) {
        addLine('stderr', data.stderr.trim());
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
  }, [files, addLine]);

  const compile = useCallback(async () => {
    await doCompile();
  }, [doCompile]);

  // ── Download FJM ──────────────────────────────────────────────────────────

  const downloadFjm = useCallback(async () => {
    let fjm = compiledFjm;
    if (!fjm) {
      fjm = await doCompile();
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
  }, [compiledFjm, doCompile, addLine]);

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
      addLine('info', `⟶ Converting ${filename} via bf2fj…`);

      importAbortRef.current?.abort();
      const ctrl = new AbortController();
      importAbortRef.current = ctrl;

      try {
        const res = await fetch('/api/bf2fj', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    [importSingleFj, addLine],
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
      addLine('info', `⟶ Converting ${file?.name ?? 'C project'} via c2fj…`);

      importAbortRef.current?.abort();
      const ctrl = new AbortController();
      importAbortRef.current = ctrl;

      try {
        const res = await fetch('/api/c2fj', {
          method: 'POST',
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
          importSingleFj('output.fj', data.fjContent);
          addLine('info', '✓ Imported output.fj');
        } else {
          addLine('error', data.error ?? 'C conversion failed.');
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        addLine('error', `c2fj error: ${(err as Error).message}`);
      }
    },
    [importSingleFj, addLine],
  );

  // ── WebSocket Runner ──────────────────────────────────────────────────────

  const killProcess = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'kill' }));
  }, []);

  const runOnline = useCallback(
    async (mode: 'fj' | 'fjm') => {
      if (runStatus === 'running') return;

      clearTerminal();
      setRunStatus('running');

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
        } else {
          addLine('info', '⟶ Compiling and running…');
          ws.send(
            JSON.stringify({
              type: 'run_fj',
              files: files.map((f) => ({ name: f.name, content: f.content })),
              initialStdin: stdinContent || undefined,
            }),
          );
        }
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as ServerMessage;
        switch (msg.type) {
          case 'started':
            runStartRef.current = Date.now();
            break;
          case 'stdout':
            addLine('stdout', msg.data);
            break;
          case 'stderr':
            addLine('stderr', msg.data);
            break;
          case 'exit': {
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [runStatus, compiledFjm, files, stdinContent, clearTerminal, addLine],
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

  // Auto-run Hello World on first visit. Wrapped so a failure (e.g. fj not
  // installed, WS blocked by proxy) doesn't surface as a cryptic error.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('fj-visited')) {
      localStorage.setItem('fj-visited', '1');
      const timer = setTimeout(() => {
        try {
          runOnline('fj');
        } catch {
          /* ignore — user can click Run themselves */
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tear down WS and in-flight requests on unmount.
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      compileAbortRef.current?.abort();
      importAbortRef.current?.abort();
    };
  }, []);

  return (
    <div
      className="flex flex-col"
      style={{ height: '100vh', background: '#1e1e1e', overflow: 'hidden' }}
    >
      <Toolbar
        compileStatus={compileStatus}
        runStatus={runStatus}
        compiledFjm={compiledFjm}
        onCompile={compile}
        onDownloadFjm={downloadFjm}
        onRunFj={() => runOnline('fj')}
        onRunFjm={() => runOnline('fjm')}
        onKill={killProcess}
        onImportBf={importBf}
        onImportC={importC}
        onImportFj={importFjFiles}
        onImportFjm={importFjm}
        onLoadExample={loadExample}
        onCopyLink={copyLink}
        onOpenDocs={() => setDocsOpen(true)}
      />

      <div className="flex flex-1 min-h-0">
        <FileTree
          files={files}
          activeFileId={activeFileId}
          sources={sources}
          activeSourceIdx={activeSourceIdx}
          onSelectFile={selectFile}
          onSelectSource={selectSource}
          onCreateFile={createFile}
          onRenameFile={renameFile}
          onDeleteFile={deleteFile}
        />

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
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
          />
          <Terminal
            lines={terminalLines}
            runStatus={runStatus}
            onSendStdin={sendStdin}
            onClear={clearTerminal}
            onKill={killProcess}
            stdinContent={stdinContent}
            onStdinContentChange={setStdinContent}
          />
        </div>
      </div>

      <DocsPanel open={docsOpen} onClose={() => setDocsOpen(false)} />
    </div>
  );
}
