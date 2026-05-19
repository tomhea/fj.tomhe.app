'use client';

import { useEffect, useRef, useState } from 'react';
import { TerminalLine, RunStatus } from '@/lib/types';

interface TerminalProps {
  lines: TerminalLine[];
  runStatus: RunStatus;
  onSendStdin: (input: string) => void;
  onClear: () => void;
  onKill: () => void;
  stdinContent: string;
  onStdinContentChange: (v: string) => void;
  /**
   * When true the terminal fills its flex parent rather than using its own
   * managed height. Used on mobile when the terminal tab is active.
   */
  fillHeight?: boolean;
}

const LINE_COLORS: Record<TerminalLine['type'], string> = {
  stdout: '#d4d4d4',
  stderr: '#f48771',
  info: '#569cd6',
  error: '#f44747',
};

export default function Terminal({
  lines, runStatus, onSendStdin, onClear, onKill,
  stdinContent, onStdinContentChange,
  fillHeight = false,
}: TerminalProps) {
  const [stdinValue, setStdinValue] = useState('');
  const [height, setHeight] = useState(240);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<'terminal' | 'stdin'>('terminal');
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  function handleStdinKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      onSendStdin(stdinValue + '\n');
      setStdinValue('');
    }
  }

  // ── Resize drag (mouse + touch) ─────────────────────────────────────────
  function startDrag(startY: number) {
    dragRef.current = { startY, startH: height };

    const move = (y: number) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - y;
      setHeight(Math.max(80, Math.min(600, dragRef.current.startH + delta)));
    };
    const end = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
    const onMouseMove = (ev: MouseEvent) => move(ev.clientY);
    const onMouseUp = end;
    const onTouchMove = (ev: TouchEvent) => { ev.preventDefault(); move(ev.touches[0].clientY); };
    const onTouchEnd = end;

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
  }

  function onDragMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    startDrag(e.clientY);
  }

  function onDragTouchStart(e: React.TouchEvent) {
    startDrag(e.touches[0].clientY);
  }

  const isRunning = runStatus === 'running';

  // When fillHeight is true (mobile terminal tab), the component must fill its
  // flex parent. We achieve this by making the root a flex-1 column and
  // removing the explicit height.
  const rootStyle = fillHeight
    ? { background: '#1e1e1e', borderTop: '1px solid #3c3c3c', display: 'flex', flexDirection: 'column' as const, flex: 1, minHeight: 0 }
    : { height: collapsed ? 32 : height, background: '#1e1e1e', borderTop: '1px solid #3c3c3c', transition: collapsed ? 'height 0.15s ease' : undefined };

  return (
    <div className="flex flex-col shrink-0" style={rootStyle}>
      {/* Drag handle — hidden on mobile (fillHeight) since height is managed by flex */}
      {!collapsed && !fillHeight && (
        <div
          className="w-full cursor-row-resize shrink-0 touch-none"
          style={{ height: 6, background: 'transparent' }}
          onMouseDown={onDragMouseDown}
          onTouchStart={onDragTouchStart}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#0078d4'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          aria-label="Resize terminal"
          role="separator"
          aria-orientation="horizontal"
        />
      )}

      {/* Header with tabs */}
      <div
        className="flex items-center shrink-0 select-none"
        style={{ height: 32, background: '#2d2d2d', borderBottom: collapsed ? 'none' : '1px solid #3c3c3c' }}
      >
        {(['terminal', 'stdin'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 text-xs transition-colors h-full flex items-center"
            style={{
              color: tab === t ? '#cccccc' : '#9e9e9e',
              borderBottom: tab === t ? '1px solid #0078d4' : '1px solid transparent',
              background: 'transparent',
              // Ensure tappable area is tall enough on mobile
              minWidth: 64,
            }}
          >
            {t === 'terminal' ? 'Terminal' : 'Pre-set Stdin'}
          </button>
        ))}

        <div className="flex-1" />

        {/* Status indicator (terminal tab only) */}
        {tab === 'terminal' && isRunning && (
          <span className="flex items-center gap-1 text-xs mr-2" style={{ color: '#73c991' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Running
          </span>
        )}
        {tab === 'terminal' && runStatus === 'exited' && (
          <span className="text-xs mr-2" style={{ color: '#969696' }}>Exited</span>
        )}
        {tab === 'terminal' && runStatus === 'error' && (
          <span className="text-xs mr-2" style={{ color: '#f44747' }}>Error</span>
        )}

        {isRunning && (
          <HeaderBtn onClick={onKill} title="Kill process" danger>Kill</HeaderBtn>
        )}
        {tab === 'terminal' && (
          <HeaderBtn onClick={onClear} title="Clear terminal">Clear</HeaderBtn>
        )}
        {/* Collapse/expand only available on desktop (when not fillHeight) */}
        {!fillHeight && (
          <HeaderBtn onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? '▲' : '▼'}
          </HeaderBtn>
        )}
      </div>

      {!collapsed && tab === 'terminal' && (
        <>
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto px-3 py-1 terminal-text"
            style={{ background: '#1e1e1e' }}
            onClick={() => inputRef.current?.focus()}
          >
            {lines.length === 0 && (
              <div style={{ color: '#555', fontSize: 12 }}>
                Ready. Run a program or compile to see output here.
              </div>
            )}
            {lines.map((line) => (
              <OutputLine key={line.id} line={line} />
            ))}
            {isRunning && (
              <span style={{ color: '#969696', fontSize: 12 }}>{'█'}</span>
            )}
          </div>

          <div
            className="flex items-center shrink-0 px-3"
            style={{ height: 40, background: '#252526', borderTop: '1px solid #3c3c3c' }}
          >
            <span className="terminal-text mr-2" style={{ color: '#569cd6', userSelect: 'none' }}>{'>'}</span>
            <input
              ref={inputRef}
              value={stdinValue}
              onChange={(e) => setStdinValue(e.target.value)}
              onKeyDown={handleStdinKeyDown}
              disabled={!isRunning}
              placeholder={isRunning ? 'Type stdin and press Enter…' : 'Run a program to enable input'}
              className="flex-1 outline-none bg-transparent terminal-text"
              style={{ color: isRunning ? '#d4d4d4' : '#555', fontSize: 13 }}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              inputMode="text"
            />
          </div>
        </>
      )}

      {!collapsed && tab === 'stdin' && (
        <div className="flex flex-col flex-1 min-h-0 p-2" style={{ background: '#1e1e1e' }}>
          <div className="text-xs mb-1" style={{ color: '#9e9e9e' }}>
            Pre-filled stdin — piped to process on start (before any interactive input)
          </div>
          <textarea
            value={stdinContent}
            onChange={(e) => onStdinContentChange(e.target.value)}
            className="flex-1 outline-none resize-none terminal-text rounded"
            style={{
              background: '#252526',
              color: '#d4d4d4',
              fontSize: 13,
              border: '1px solid #3c3c3c',
              padding: '6px 8px',
            }}
            placeholder="Enter stdin content here…"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      )}
    </div>
  );
}

function OutputLine({ line }: { line: TerminalLine }) {
  const color = LINE_COLORS[line.type];
  const segments = line.text.split('\n');
  return (
    <>
      {segments.map((seg, i) => (
        <div
          key={i}
          style={{
            color,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            minHeight: seg ? undefined : '0.5em',
          }}
        >
          {seg}
        </div>
      ))}
    </>
  );
}

function HeaderBtn({
  children, onClick, title, danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="px-2 py-0.5 text-xs rounded transition-colors"
      style={{ color: danger ? '#f44747' : '#969696', minHeight: 32 }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#3a3a3a'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}
