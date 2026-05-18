'use client';

import { useRef, useState } from 'react';
import { CompileStatus, RunStatus } from '@/lib/types';
import { EXAMPLES, Example } from '@/lib/examples';

interface ToolbarProps {
  compileStatus: CompileStatus;
  runStatus: RunStatus;
  compiledFjm: string | null;
  onCompile: () => void;
  onDownloadFjm: () => void;
  onRunFj: () => void;
  onRunFjm: () => void;
  onKill: () => void;
  onImportBf: (content: string, filename: string) => void;
  onImportC: (formData: FormData) => void;
  onImportFj: (files: Array<{ name: string; content: string }>) => void;
  onImportFjm: (base64: string) => void;
  onLoadExample: (ex: Example) => void;
  onCopyLink: () => void;
  onOpenDocs: () => void;
}

export default function Toolbar({
  compileStatus, runStatus, compiledFjm,
  onCompile, onDownloadFjm, onRunFj, onRunFjm, onKill,
  onImportBf, onImportC, onImportFj, onImportFjm,
  onLoadExample, onCopyLink, onOpenDocs,
}: ToolbarProps) {
  const bfInputRef = useRef<HTMLInputElement>(null);
  const cInputRef = useRef<HTMLInputElement>(null);
  const fjInputRef = useRef<HTMLInputElement>(null);
  const fjmInputRef = useRef<HTMLInputElement>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const isRunning = runStatus === 'running';
  const isCompiling = compileStatus === 'compiling';

  async function handleBfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    onImportBf(content, file.name);
    e.target.value = '';
  }

  function handleCUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    onImportC(fd);
    e.target.value = '';
  }

  async function handleFjUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = Array.from(e.target.files ?? []);
    if (!uploadedFiles.length) return;
    const parsed = await Promise.all(
      uploadedFiles.map(async (f) => ({ name: f.name, content: await f.text() }))
    );
    onImportFj(parsed);
    e.target.value = '';
  }

  async function handleFjmUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    onImportFjm(base64);
    e.target.value = '';
  }

  function handleCopyLink() {
    onCopyLink();
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <div
      className="flex items-center gap-1 px-3 py-1 shrink-0 select-none relative"
      style={{ background: '#323233', borderBottom: '1px solid #3c3c3c', height: 40 }}
    >
      {/* Logo */}
      <span className="font-bold text-sm mr-3" style={{ color: '#e8c47a', letterSpacing: 1 }}>
        FlipJump
      </span>

      <div className="w-px h-5 mx-1" style={{ background: '#555' }} />

      {/* FJ file import */}
      <input ref={fjInputRef} type="file" accept=".fj" multiple className="hidden" onChange={handleFjUpload} />
      <ToolBtn onClick={() => fjInputRef.current?.click()} title="Import .fj files">
        <FolderOpenIcon /> Import FJ
      </ToolBtn>

      {/* Examples dropdown */}
      <div className="relative">
        <ToolBtn onClick={() => setExamplesOpen(o => !o)} title="Load a built-in example">
          <StarIcon /> Examples
        </ToolBtn>
        {examplesOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setExamplesOpen(false)} />
            <div
              className="absolute top-full left-0 z-20 rounded shadow-lg py-1 text-xs"
              style={{ background: '#252526', border: '1px solid #454545', minWidth: 180, marginTop: 2 }}
            >
              {EXAMPLES.map(ex => (
                <button
                  key={ex.name}
                  onClick={() => { onLoadExample(ex); setExamplesOpen(false); }}
                  className="block w-full text-left px-3 py-1.5 transition-colors"
                  style={{ color: '#cccccc' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#094771'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <div style={{ fontWeight: 500 }}>{ex.name}</div>
                  <div style={{ color: '#666', fontSize: 11 }}>{ex.description}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Compile */}
      <ToolBtn onClick={onCompile} disabled={isCompiling || isRunning} title="Compile FJ → FJM">
        {isCompiling
          ? <SpinnerIcon />
          : <BuildIcon color={compileStatus === 'success' ? '#4ec9b0' : compileStatus === 'error' ? '#f44747' : '#cccccc'} />}
        Compile
      </ToolBtn>

      {/* Download FJM */}
      <ToolBtn onClick={onDownloadFjm} disabled={isCompiling} title="Compile and download .fjm binary">
        <DownloadIcon color={compiledFjm ? '#4ec9b0' : '#cccccc'} /> Download FJM
      </ToolBtn>

      {/* Upload FJM */}
      <input ref={fjmInputRef} type="file" accept=".fjm" className="hidden" onChange={handleFjmUpload} />
      <ToolBtn onClick={() => fjmInputRef.current?.click()} title="Upload a compiled .fjm binary to run">
        <UploadIcon /> Upload FJM
      </ToolBtn>

      <div className="w-px h-5 mx-1" style={{ background: '#555' }} />

      {/* Run FJ */}
      <ToolBtn
        onClick={isRunning ? onKill : onRunFj}
        title={isRunning ? 'Kill process' : 'Compile and run FJ online'}
        accent={isRunning}
      >
        {isRunning ? <StopIcon /> : <PlayIcon />}
        {isRunning ? 'Kill' : 'Run FJ'}
      </ToolBtn>

      {/* Run FJM */}
      {compiledFjm && !isRunning && (
        <ToolBtn onClick={onRunFjm} title="Run compiled FJM online">
          <PlayIcon color="#4ec9b0" /> Run FJM
        </ToolBtn>
      )}

      <div className="flex-1" />

      {/* Copy link */}
      <ToolBtn onClick={handleCopyLink} title="Copy shareable link to clipboard">
        <LinkIcon />
        {linkCopied ? 'Copied!' : 'Copy Link'}
      </ToolBtn>

      <div className="w-px h-5 mx-1" style={{ background: '#555' }} />

      {/* BF import */}
      <input ref={bfInputRef} type="file" accept=".bf,.b" className="hidden" onChange={handleBfUpload} />
      <ToolBtn onClick={() => bfInputRef.current?.click()} title="Import Brainfuck → compile to FJ">
        <BrainIcon /> BF → FJ
      </ToolBtn>

      {/* C import */}
      <input ref={cInputRef} type="file" accept=".c,.cpp,.zip" className="hidden" onChange={handleCUpload} />
      <ToolBtn onClick={() => cInputRef.current?.click()} title="Import C project (.c, .cpp, or .zip) → compile to FJ">
        <CIcon /> C → FJ
      </ToolBtn>

      <div className="w-px h-5 mx-1" style={{ background: '#555' }} />

      {/* Docs */}
      <ToolBtn onClick={onOpenDocs} title="Open language reference and STL viewer">
        <BookIcon /> Docs
      </ToolBtn>
    </div>
  );
}

function ToolBtn({
  children, onClick, disabled, title, accent,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
      style={{
        color: disabled ? '#666' : accent ? '#fff' : '#cccccc',
        background: accent ? '#c72e2e' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !accent) (e.currentTarget as HTMLButtonElement).style.background = '#3a3a3a';
      }}
      onMouseLeave={(e) => {
        if (!accent) (e.currentTarget as HTMLButtonElement).style.background = accent ? '#c72e2e' : 'transparent';
      }}
    >
      {children}
    </button>
  );
}

// --- Icons ---

function PlayIcon({ color = '#73c991' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={color}>
      <path d="M4 2l10 6-10 6V2z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="#f44747">
      <rect x="3" y="3" width="10" height="10" />
    </svg>
  );
}

function BuildIcon({ color = '#cccccc' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M2 14l3-3 7-7-3-3-7 7-3 3 3 3z" />
      <path d="M9 3l4 4" />
    </svg>
  );
}

function DownloadIcon({ color = '#cccccc' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M8 2v8M5 7l3 3 3-3" />
      <path d="M2 13h12" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#cccccc" strokeWidth="1.5">
      <path d="M8 10V2M5 5l3-3 3 3" />
      <path d="M2 13h12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cca700" strokeWidth="2"
      style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

function FolderOpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#cccccc" strokeWidth="1.5">
      <path d="M1 4h5l2 2h7v8H1V4z" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#b5a0e8" strokeWidth="1.5">
      <path d="M8 2c-2 0-4 1.5-4 4 0 1 .5 2 1 2.5C4 9 3 10 3 11.5 3 13 4.5 14 6 14h4c1.5 0 3-1 3-2.5 0-1.5-1-2.5-2-3 .5-.5 1-1.5 1-2.5C12 3.5 10 2 8 2z" />
    </svg>
  );
}

function CIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <text x="1" y="13" fontSize="12" fontWeight="bold" fill="#5aa4e8" fontFamily="monospace">C</text>
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#e8c47a" strokeWidth="1.5">
      <path d="M8 1l2 5h5l-4 3 1.5 5L8 11l-4.5 3 1.5-5L1 6h5z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#cccccc" strokeWidth="1.5">
      <path d="M7 9a3 3 0 0 0 4.3.3l2-2a3 3 0 0 0-4.2-4.2L7.8 4.4" />
      <path d="M9 7a3 3 0 0 0-4.3-.3l-2 2a3 3 0 0 0 4.2 4.2l1.3-1.3" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#cccccc" strokeWidth="1.5">
      <path d="M3 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M8 2v12" />
    </svg>
  );
}
