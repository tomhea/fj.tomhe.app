'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';
import Terminal from './Terminal';
import Toolbar from './Toolbar';
import DocsPanel from './DocsPanel';
import { FJFile, SourceFile, TerminalLine, CompileStatus, RunStatus, ServerMessage, MonacoMarker } from '@/lib/types';
import { EXAMPLES, Example } from '@/lib/examples';
import { encodeShare, decodeShare } from '@/lib/share';

const EXAMPLE_FJ = `; FlipJump Hello World
; ----------------------
; The FlipJump language has a single instruction: f;j
;   - Flip the bit at address f
;   - Then jump to address j
;
; This example uses the standard library macros.
; Modify the files and click "Run FJ" to execute.

.startup main

main:
    output 'H'
    output 'e'
    output 'l'
    output 'l'
    output 'o'
    output ','
    output ' '
    output 'W'
    output 'o'
    output 'r'
    output 'l'
    output 'd'
    output '!'
    output '\\n'
    halt
`;

function makeDefaultFile(): FJFile {
  return { id: uuidv4(), name: 'main.fj', content: EXAMPLE_FJ };
}

let lineCounter = 0;
function nextLineId() { return ++lineCounter; }

function parseMarkers(stderr: string): MonacoMarker[] {
  const markers: MonacoMarker[] = [];
  const re = /^(.+?):(\d+)(?::(\d+))?:\s*(?:Error|error|Warning|warning):\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stderr)) !== null) {
    markers.push({
      filename: m[1].split('/').pop() ?? m[1],
      startLine: parseInt(m[2], 10),
      startCol: m[3] ? parseInt(m[3], 10) : 1,
      message: m[4],
    });
  }
  return markers;
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
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded */ }
}

export default function IDE() {
  // ── Initialise from URL share param or localStorage ──────────────────────
  function initFiles(): FJFile[] {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const shared = params.get('share');
      if (shared) {
        const decoded = decodeShare(shared);
        if (decoded) return decoded.map(f => ({ ...f, id: uuidv4() }));
      }
      const saved = loadFromLocalStorage<FJFile[]>('fj-ide-files');
      if (saved?.length) return saved;
    }
    return [makeDefaultFile()];
  }

  function initSources(): SourceFile[] {
    return loadFromLocalStorage<SourceFile[]>('fj-ide-sources') ?? [];
  }

  const [files, setFiles] = useState<FJFile[]>(initFiles);
  const [activeFileId, setActiveFileId] = useState<string>(() => {
    const f = initFiles();
    return f[0]?.id ?? '';
  });
  const [sources, setSources] = useState<SourceFile[]>(initSources);
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

  // ── Persist files to localStorage ────────────────────────────────────────
  useEffect(() => { saveToLocalStorage('fj-ide-files', files); }, [files]);
  useEffect(() => { saveToLocalStorage('fj-ide-sources', sources); }, [sources]);

  // ── Update share URL (debounced 1s) ──────────────────────────────────────
  useEffect(() => {
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    shareTimerRef.current = setTimeout(() => {
      const encoded = encodeShare(files);
      if (encoded.length < 200_000) {
        const url = new URL(window.location.href);
        url.searchParams.set('share', encoded);
        window.history.replaceState(null, '', url.toString());
      }
    }, 1000);
    return () => { if (shareTimerRef.current) clearTimeout(shareTimerRef.current); };
  }, [files]);

  // ── Auto-run Hello World on very first visit ──────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('fj-visited')) {
      localStorage.setItem('fj-visited', '1');
      const timer = setTimeout(() => runOnline('fj'), 1000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLine = useCallback((type: TerminalLine['type'], text: string) => {
    setTerminalLines(prev => [...prev, { type, text, id: nextLineId() }]);
  }, []);

  const clearTerminal = useCallback(() => setTerminalLines([]), []);

  // ── Active view: FJ file or source ───────────────────────────────────────
  const activeFile = files.find(f => f.id === activeFileId) ?? files[0];

  const viewFile: FJFile | undefined = activeSourceIdx !== null && sources[activeSourceIdx]
    ? { id: `source-${activeSourceIdx}`, name: sources[activeSourceIdx].name, content: sources[activeSourceIdx].content }
    : activeFile;

  const viewReadOnly = activeSourceIdx !== null;
  const viewLanguage = activeSourceIdx !== null
    ? (sources[activeSourceIdx]?.type === 'bf' ? 'brainfuck' : 'c')
    : undefined;

  function selectFile(id: string) {
    setActiveFileId(id);
    setActiveSourceIdx(null);
  }

  function selectSource(idx: number) {
    setActiveSourceIdx(idx);
  }

  const updateFileContent = useCallback((id: string, content: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, content } : f));
    setCompiledFjm(null);
    setMarkers([]);
  }, []);

  const createFile = useCallback((name: string) => {
    const f: FJFile = { id: uuidv4(), name, content: `; ${name}\n` };
    setFiles(prev => [...prev, f]);
    setActiveFileId(f.id);
    setActiveSourceIdx(null);
  }, []);

  const renameFile = useCallback((id: string, name: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, name } : f));
  }, []);

  const deleteFile = useCallback((id: string) => {
    setFiles(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(f => f.id !== id);
      setActiveFileId(current => current === id ? next[0].id : current);
      return next;
    });
  }, []);

  const importFjFiles = useCallback((incoming: Array<{ name: string; content: string }>) => {
    setFiles(prev => {
      const updated = [...prev];
      let lastId = '';
      for (const inc of incoming) {
        const existing = updated.find(f => f.name === inc.name);
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
      if (lastId) { setActiveFileId(lastId); setActiveSourceIdx(null); }
      return updated;
    });
  }, []);

  const importSingleFj = useCallback((name: string, content: string) => {
    importFjFiles([{ name, content }]);
  }, [importFjFiles]);

  const loadExample = useCallback((ex: Example) => {
    const newFiles = ex.files.map(f => ({ ...f, id: uuidv4() }));
    setFiles(newFiles);
    setActiveFileId(newFiles[0].id);
    setActiveSourceIdx(null);
    setCompiledFjm(null);
    setMarkers([]);
  }, []);

  const importFjm = useCallback((base64: string) => {
    setCompiledFjm(base64);
    addLine('info', '↑ Loaded program.fjm');
  }, [addLine]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
  }, []);

  // ── Compile ───────────────────────────────────────────────────────────────

  const doCompile = useCallback(async (): Promise<string | null> => {
    setCompileStatus('compiling');
    setMarkers([]);
    addLine('info', '⟶ Compiling…');
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: files.map(f => ({ name: f.name, content: f.content })) }),
      });
      const data = await res.json() as {
        success: boolean; fjmBase64?: string; stderr?: string; error?: string;
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
      setCompileStatus('error');
      addLine('error', `Compilation error: ${(err as Error).message}`);
      return null;
    }
  }, [files, addLine]);

  const compile = useCallback(async () => { await doCompile(); }, [doCompile]);

  // ── Download FJM ──────────────────────────────────────────────────────────

  const downloadFjm = useCallback(async () => {
    let fjm = compiledFjm;
    if (!fjm) { fjm = await doCompile(); }
    if (!fjm) return;

    const bytes = Uint8Array.from(atob(fjm), c => c.charCodeAt(0));
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

  const importBf = useCallback(async (content: string, filename: string) => {
    setSources(prev => {
      const existing = prev.findIndex(s => s.name === filename && s.type === 'bf');
      const entry: SourceFile = { name: filename, type: 'bf', content };
      return existing >= 0 ? prev.map((s, i) => i === existing ? entry : s) : [...prev, entry];
    });
    addLine('info', `⟶ Converting ${filename} via bf2fj…`);
    try {
      const res = await fetch('/api/bf2fj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename }),
      });
      const data = await res.json() as { success: boolean; fjContent?: string; stderr?: string; error?: string };
      if (data.stderr?.trim()) addLine('stderr', data.stderr.trim());
      if (data.success && data.fjContent) {
        const name = filename.replace(/\.(bf|b)$/i, '.fj');
        importSingleFj(name, data.fjContent);
        addLine('info', `✓ Imported ${name}`);
      } else {
        addLine('error', data.error ?? 'BF conversion failed.');
      }
    } catch (err) {
      addLine('error', `bf2fj error: ${(err as Error).message}`);
    }
  }, [importSingleFj, addLine]);

  // ── Import C ──────────────────────────────────────────────────────────────

  const importC = useCallback(async (formData: FormData) => {
    const file = formData.get('file') as File;
    const isZip = file?.name.endsWith('.zip');
    if (file) {
      const content = isZip ? '(zip archive)' : await file.text();
      setSources(prev => {
        const entry: SourceFile = { name: file.name, type: 'c', content };
        const existing = prev.findIndex(s => s.name === file.name && s.type === 'c');
        return existing >= 0 ? prev.map((s, i) => i === existing ? entry : s) : [...prev, entry];
      });
    }
    addLine('info', `⟶ Converting ${file?.name ?? 'C project'} via c2fj…`);
    try {
      const res = await fetch('/api/c2fj', { method: 'POST', body: formData });
      const data = await res.json() as { success: boolean; fjContent?: string; stderr?: string; error?: string };
      if (data.stderr?.trim()) addLine('stderr', data.stderr.trim());
      if (data.success && data.fjContent) {
        importSingleFj('output.fj', data.fjContent);
        addLine('info', '✓ Imported output.fj');
      } else {
        addLine('error', data.error ?? 'C conversion failed.');
      }
    } catch (err) {
      addLine('error', `c2fj error: ${(err as Error).message}`);
    }
  }, [importSingleFj, addLine]);

  // ── WebSocket Runner ──────────────────────────────────────────────────────

  const killProcess = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'kill' }));
  }, []);

  const runOnline = useCallback(async (mode: 'fj' | 'fjm') => {
    if (runStatus === 'running') return;

    clearTerminal();
    setRunStatus('running');

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProto}//${window.location.host}/ws/run`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mode === 'fjm' && compiledFjm) {
        addLine('info', '⟶ Running compiled FJM…');
        ws.send(JSON.stringify({
          type: 'run_fjm',
          fjmBase64: compiledFjm,
          initialStdin: stdinContent || undefined,
        }));
      } else {
        addLine('info', '⟶ Compiling and running…');
        ws.send(JSON.stringify({
          type: 'run_fj',
          files: files.map(f => ({ name: f.name, content: f.content })),
          initialStdin: stdinContent || undefined,
        }));
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
          addLine('info',
            msg.code === 0
              ? `✓ Process exited (code 0) — ${elapsed}s`
              : `Process exited with code ${msg.code ?? '?'} — ${elapsed}s`
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
      setRunStatus(s => s === 'running' ? 'exited' : s);
      wsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runStatus, compiledFjm, files, stdinContent, clearTerminal, addLine]);

  const sendStdin = useCallback((input: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stdin', stdin: input }));
      addLine('info', `> ${input.trimEnd()}`);
    }
  }, [addLine]);

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  return (
    <div className="flex flex-col" style={{ height: '100vh', background: '#1e1e1e', overflow: 'hidden' }}>
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
