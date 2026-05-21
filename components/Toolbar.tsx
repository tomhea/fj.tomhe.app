'use client';

import { useRef, useState, useEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { unzipSync } from 'fflate';
import { CompileStatus, RunStatus } from '@/lib/types';
import { EXAMPLES, Example } from '@/lib/examples';

interface ToolbarProps {
  compileStatus: CompileStatus;
  runStatus: RunStatus;
  compiledFjm: string | null;
  onCompile: () => void;
  onDownloadFjm: () => void;
  /** Download all FJ files as a project (single .fj or .zip). */
  onDownloadFjProject: () => void;
  onRunFj: () => void;
  onRunFjm: () => void;
  onKill: () => void;
  onImportBf: (content: string, filename: string) => void;
  onImportC: (formData: FormData) => void;
  onImportFj: (files: Array<{ name: string; content: string }>, replace?: boolean) => void;
  /** Called when an import fails — message is shown in the terminal. */
  onImportError: (message: string) => void;
  onImportFjm: (base64: string) => void;
  onLoadExample: (ex: Example) => void;
  onCopyLink: () => void;
  onOpenDocs: () => void;
  /** Non-null when a C→FJ conversion result is ready to run directly. */
  c2fjOutput: string | null;
  onRunC2fjSource: () => void;
}

export default function Toolbar({
  compileStatus, runStatus, compiledFjm,
  onCompile, onDownloadFjm, onDownloadFjProject, onRunFj, onRunFjm, onKill,
  onImportBf, onImportC, onImportFj, onImportError, onImportFjm,
  onLoadExample, onCopyLink, onOpenDocs,
  c2fjOutput, onRunC2fjSource,
}: ToolbarProps) {
  const bfInputRef = useRef<HTMLInputElement>(null);
  const cInputRef = useRef<HTMLInputElement>(null);
  const fjInputRef = useRef<HTMLInputElement>(null);
  const fjmInputRef = useRef<HTMLInputElement>(null);
  const examplesBtnRef = useRef<HTMLButtonElement>(null);
  const shortBtnRef = useRef<HTMLButtonElement>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  type ShortState = 'idle' | 'loading' | 'copied' | 'error' | 'cooldown';
  const [shortState, setShortState] = useState<ShortState>('idle');
  const [shortUrl, setShortUrl] = useState('');
  const [shortTooltipPos, setShortTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recompute dropdown position whenever it opens or the window resizes/scrolls.
  useEffect(() => {
    if (!examplesOpen) return;
    function updatePos() {
      const rect = examplesBtnRef.current?.getBoundingClientRect();
      if (rect) setDropdownPos({ top: rect.bottom + 2, left: rect.left });
    }
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [examplesOpen]);

  const isRunning = runStatus === 'running';
  const isCompiling = compileStatus === 'compiling';

  async function handleBfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    onImportBf(content, file.name);
    e.target.value = '';
  }

  async function handleFjUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = Array.from(e.target.files ?? []);
    if (!uploadedFiles.length) return;

    // Single .zip → treat as a "Download Project" zip: read files_order.txt for order,
    // then extract all .fj files in that order, replacing the current project.
    if (uploadedFiles.length === 1 && uploadedFiles[0].name.toLowerCase().endsWith('.zip')) {
      try {
        const buf = await uploadedFiles[0].arrayBuffer();
        const entries = unzipSync(new Uint8Array(buf));
        const decoder = new TextDecoder('utf-8');

        // Determine compilation order from files_order.txt (newline-separated names)
        const orderRaw = entries['files_order.txt']
          ? decoder.decode(entries['files_order.txt'])
          : null;
        const orderedNames: string[] = orderRaw
          ? orderRaw.split('\n').map(s => s.trim()).filter(s => s.endsWith('.fj'))
          : Object.keys(entries).filter(k => k.endsWith('.fj')).sort();

        const parsed = orderedNames
          .filter(name => entries[name] !== undefined)
          .map(name => ({ name, content: decoder.decode(entries[name]) }));

        if (parsed.length > 0) {
          // replace=true: discard existing .fj files, load only the zip's files
          onImportFj(parsed, true);
        } else {
          onImportError('ZIP import: no .fj files found in archive.');
        }
      } catch (err) {
        onImportError(`ZIP import failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      e.target.value = '';
      return;
    }

    // Regular .fj file(s)
    const parsed = await Promise.all(
      uploadedFiles.map(async (f) => ({ name: f.name, content: await f.text() }))
    );
    onImportFj(parsed);
    e.target.value = '';
  }

  async function handleFjmUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      // `btoa(String.fromCharCode(...uint8))` blows the call stack on
      // multi-MB FJMs. Chunked binary-string build keeps memory bounded.
      const bytes = new Uint8Array(buf);
      const CHUNK = 0x8000;
      let bin = '';
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      onImportFjm(btoa(bin));
    } catch (err) {
      console.error('FJM upload failed:', err);
    } finally {
      e.target.value = '';
    }
  }

  function handleCopyLink() {
    onCopyLink();
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function handleImportC(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    onImportC(fd);
    e.target.value = '';
  }

  async function handleShortLink() {
    if (shortState === 'loading' || shortState === 'copied' || shortState === 'cooldown') return;
    const longUrl = window.location.href;
    if (!longUrl.includes('#share=')) {
      // Nothing shared yet — fall back to generating the share URL first
      onCopyLink();
    }
    const urlToShorten = window.location.href;
    setShortState('loading');

    // Position the tooltip below the button
    const rect = shortBtnRef.current?.getBoundingClientRect();
    if (rect) setShortTooltipPos({ top: rect.bottom + 6, left: rect.left });

    try {
      const res = await fetch('https://spoo.me/', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ url: urlToShorten }),
      });
      if (!res.ok) throw new Error(`spoo.me ${res.status}`);
      const data = await res.json() as { short_url: string };
      const short = data.short_url;
      await navigator.clipboard.writeText(short);
      setShortUrl(short);
      setShortState('copied');

      // Hide tooltip + enter 30s cooldown
      setTimeout(() => {
        setShortState('cooldown');
        setShortTooltipPos(null);
        cooldownRef.current = setTimeout(() => setShortState('idle'), 30_000);
      }, 3000);
    } catch {
      setShortState('error');
      setTimeout(() => setShortState('idle'), 3000);
    }
  }

  return (
    <div
      className="flex items-center gap-1 px-3 py-1 shrink-0 select-none relative overflow-x-auto h-12 md:h-10"
      style={{
        background: '#323233',
        borderBottom: '1px solid #3c3c3c',
        // pan-x lets the user swipe the toolbar horizontally on touch without
        // the gesture being swallowed by any parent scroll container.
        touchAction: 'pan-x',
      }}
    >
      {/* Logo */}
      <span className="font-bold text-sm mr-3" style={{ color: '#e8c47a', letterSpacing: 1 }}>
        FlipJump IDE
      </span>

      <div className="w-px h-5 mx-1" style={{ background: '#555' }} />

      {/* FJ file import — also accepts a project .zip (files_order.txt + .fj files) */}
      <input ref={fjInputRef} type="file" accept=".fj,.zip" multiple className="hidden" onChange={handleFjUpload} />
      <ToolBtn onClick={() => fjInputRef.current?.click()} title="Import .fj files or a project .zip">
        <FolderOpenIcon /> Import FJ
      </ToolBtn>

      {/* Examples dropdown — panel is portalled to <body> so the toolbar's
          overflow-x-auto scroll container cannot clip it. */}
      <div>
        <ToolBtn
          ref={examplesBtnRef}
          onClick={() => setExamplesOpen(o => !o)}
          title="Load a built-in example"
        >
          <StarIcon /> Examples
        </ToolBtn>
        {examplesOpen && dropdownPos && createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setExamplesOpen(false)} />
            <div
              className="fixed z-50 rounded shadow-lg py-1 text-xs"
              style={{
                background: '#252526',
                border: '1px solid #454545',
                minWidth: 180,
                top: dropdownPos.top,
                left: dropdownPos.left,
              }}
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
                  <div style={{ color: '#9e9e9e', fontSize: 11 }}>{ex.description}</div>
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
      </div>

      {/* Compile */}
      <ToolBtn onClick={onCompile} disabled={isCompiling || isRunning} title="Compile FJ → FJM">
        {isCompiling
          ? <SpinnerIcon />
          : <BuildIcon color={compileStatus === 'success' ? '#4ec9b0' : compileStatus === 'error' ? '#f44747' : '#cccccc'} />}
        Compile
      </ToolBtn>

      {/* Download Project (FJ source) — comes before Download FJM */}
      <ToolBtn onClick={onDownloadFjProject} title="Download FJ source files (single .fj or .zip for multi-file projects)">
        <DownloadIcon color="#cccccc" /> Download Project
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

      {/* Short link via spoo.me */}
      <div className="relative">
        <ToolBtn
          ref={shortBtnRef}
          onClick={handleShortLink}
          disabled={shortState === 'loading' || shortState === 'copied' || shortState === 'cooldown'}
          title={
            shortState === 'cooldown' ? 'Please wait before generating another short link' :
            'Shorten link via spoo.me and copy to clipboard'
          }
        >
          <ScissorsIcon />
          {shortState === 'loading' ? 'Shortening…' :
           shortState === 'error'   ? 'Failed' :
           shortState === 'cooldown' ? 'Short Link' :
           'Short Link'}
        </ToolBtn>
        {/* Tooltip: appears above button when copied, portalled to avoid overflow clipping */}
        {(shortState === 'copied') && shortTooltipPos && createPortal(
          <div
            className="fixed text-xs rounded px-2 py-1 shadow-lg pointer-events-none"
            style={{
              top: shortTooltipPos.top,
              left: shortTooltipPos.left,
              background: '#1e1e1e',
              border: '1px solid #454545',
              color: '#73c991',
              whiteSpace: 'nowrap',
              zIndex: 60,
            }}
          >
            ✓ Copied — {shortUrl}
          </div>,
          document.body,
        )}
      </div>

      <div className="w-px h-5 mx-1" style={{ background: '#555' }} />

      {/* BF import */}
      <input ref={bfInputRef} type="file" accept=".bf,.b" className="hidden" onChange={handleBfUpload} />
      <ToolBtn onClick={() => bfInputRef.current?.click()} title="Import Brainfuck → compile to FJ">
        <BrainIcon /> BF → FJ
      </ToolBtn>

      {/* C import */}
      <input ref={cInputRef} type="file" accept=".c,.cpp,.zip" className="hidden" onChange={handleImportC} />
      <ToolBtn onClick={() => cInputRef.current?.click()} title="Import C project (.c, .cpp, or .zip) → compile to FJ">
        <CIcon /> C → FJ
      </ToolBtn>

      {/* Run C→FJ output — only shown when a c2fj result is ready */}
      {c2fjOutput && !isRunning && (
        <ToolBtn
          onClick={onRunC2fjSource}
          title="Run the compiled FJ file directly"
        >
          <PlayIcon color="#5aa4e8" /> Run C→FJ output
        </ToolBtn>
      )}

      <div className="w-px h-5 mx-1" style={{ background: '#555' }} />

      {/* Docs */}
      <ToolBtn onClick={onOpenDocs} title="Open language reference and STL viewer">
        <BookIcon /> Docs
      </ToolBtn>
    </div>
  );
}

const ToolBtn = forwardRef<HTMLButtonElement, {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  accent?: boolean;
}>(function ToolBtn({ children, onClick, disabled, title, accent }, ref) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors shrink-0"
      style={{
        color: disabled ? '#666' : accent ? '#fff' : '#cccccc',
        background: accent ? '#c72e2e' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        minHeight: 36, // comfortable touch target
        whiteSpace: 'nowrap',
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
});

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

function ScissorsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#cccccc" strokeWidth="1.5">
      <circle cx="4" cy="4" r="2" />
      <circle cx="4" cy="12" r="2" />
      <path d="M6 4.5L14 9M6 11.5L14 7" />
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
