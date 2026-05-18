'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';
import Terminal from './Terminal';
import Toolbar from './Toolbar';
import { FJFile, TerminalLine, CompileStatus, RunStatus, ServerMessage } from '@/lib/types';

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

const DEFAULT_FILE: FJFile = {
  id: uuidv4(),
  name: 'main.fj',
  content: EXAMPLE_FJ,
};

let lineCounter = 0;
function nextLineId() { return ++lineCounter; }

export default function IDE() {
  const [files, setFiles] = useState<FJFile[]>([DEFAULT_FILE]);
  const [activeFileId, setActiveFileId] = useState<string>(DEFAULT_FILE.id);
  const [compiledFjm, setCompiledFjm] = useState<string | null>(null);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [compileStatus, setCompileStatus] = useState<CompileStatus>('idle');
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const wsRef = useRef<WebSocket | null>(null);

  const addLine = useCallback((type: TerminalLine['type'], text: string) => {
    setTerminalLines(prev => [...prev, { type, text, id: nextLineId() }]);
  }, []);

  const clearTerminal = useCallback(() => setTerminalLines([]), []);

  const activeFile = files.find(f => f.id === activeFileId) ?? files[0];

  const updateFileContent = useCallback((id: string, content: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, content } : f));
    setCompiledFjm(null); // invalidate when files change
  }, []);

  const createFile = useCallback((name: string) => {
    const f: FJFile = { id: uuidv4(), name, content: `; ${name}\n` };
    setFiles(prev => [...prev, f]);
    setActiveFileId(f.id);
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
      if (lastId) setActiveFileId(lastId);
      return updated;
    });
  }, []);

  const importSingleFj = useCallback((name: string, content: string) => {
    importFjFiles([{ name, content }]);
  }, [importFjFiles]);

  // ── Compile ──────────────────────────────────────────────────────────────

  const doCompile = useCallback(async (): Promise<string | null> => {
    setCompileStatus('compiling');
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

      if (data.stderr?.trim()) addLine('stderr', data.stderr.trim());

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

  // ── Download FJM ─────────────────────────────────────────────────────────

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

  // ── Import BF ────────────────────────────────────────────────────────────

  const importBf = useCallback(async (content: string, filename: string) => {
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

  // ── Import C ─────────────────────────────────────────────────────────────

  const importC = useCallback(async (formData: FormData) => {
    const file = formData.get('file') as File;
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
        ws.send(JSON.stringify({ type: 'run_fjm', fjmBase64: compiledFjm }));
      } else {
        addLine('info', '⟶ Compiling and running…');
        ws.send(JSON.stringify({
          type: 'run_fj',
          files: files.map(f => ({ name: f.name, content: f.content })),
        }));
      }
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;
      switch (msg.type) {
        case 'started':
          break;
        case 'stdout':
          addLine('stdout', msg.data);
          break;
        case 'stderr':
          addLine('stderr', msg.data);
          break;
        case 'exit':
          addLine('info',
            msg.code === 0
              ? '✓ Process exited (code 0).'
              : `Process exited with code ${msg.code ?? '?'}.`
          );
          setRunStatus('exited');
          wsRef.current = null;
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
      setRunStatus(s => s === 'running' ? 'exited' : s);
      wsRef.current = null;
    };
  }, [runStatus, compiledFjm, files, clearTerminal, addLine]);

  const sendStdin = useCallback((input: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stdin', stdin: input }));
      // Echo stdin to terminal
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
      />

      <div className="flex flex-1 min-h-0">
        <FileTree
          files={files}
          activeFileId={activeFileId}
          onSelectFile={setActiveFileId}
          onCreateFile={createFile}
          onRenameFile={renameFile}
          onDeleteFile={deleteFile}
        />

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <CodeEditor
            file={activeFile}
            onChange={(content) => updateFileContent(activeFile?.id ?? '', content)}
          />
          <Terminal
            lines={terminalLines}
            runStatus={runStatus}
            onSendStdin={sendStdin}
            onClear={clearTerminal}
            onKill={killProcess}
          />
        </div>
      </div>
    </div>
  );
}
