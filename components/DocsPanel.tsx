'use client';

import { useEffect, useRef, useState } from 'react';
import StlViewer from './StlViewer';

interface DocsPanelProps {
  open: boolean;
  onClose: () => void;
  /** When set, the panel opens to the STL tab with this pre-filled search query. */
  initialStlSearch?: string;
  /** Incremented by IDE on every Ctrl+click so StlViewer re-arms auto-select even
   *  when the query string hasn't changed (same word clicked twice). */
  initialStlSearchTick?: number;
}

export default function DocsPanel({ open, onClose, initialStlSearch, initialStlSearchTick }: DocsPanelProps) {
  const [tab, setTab] = useState<'ref' | 'stl'>('ref');
  const [fullWidth, setFullWidth] = useState(false);

  // Reset full-width when the panel is closed.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setFullWidth(false);
  }, [open]);

  // When opened with an initial STL search term, switch to the STL tab.
  useEffect(() => {
    if (open && initialStlSearch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab('stl');
    }
  }, [open, initialStlSearch]);

  const panelRef = useRef<HTMLDivElement | null>(null);
  // Remember the trigger so we can restore focus when the panel closes —
  // standard a11y pattern for transient dialogs.
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Close on Escape + trap Tab focus inside the panel while open.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the panel so screen-reader / keyboard users land here.
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();

    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      // Trap Tab cycling within the panel.
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // Restore focus to the trigger.
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'transparent' }}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Documentation"
        // `inert` removes the whole subtree from the focus/AT order when
        // closed (modern alternative to aria-hidden + tabindex sweep).
        // React 19 supports `inert` natively; pass `true` (not "") so the
        // boolean attribute is actually set on the DOM element.
        inert={open ? undefined : true}
        style={{
          width: fullWidth ? '100dvw' : 'clamp(400px, 42vw, 700px)',
          background: '#1e1e1e',
          borderLeft: '1px solid #3c3c3c',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.2s ease',
          boxShadow: open ? '-4px 0 24px rgba(0,0,0,0.5)' : 'none',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center shrink-0 px-4"
          style={{ height: 40, background: '#252526', borderBottom: '1px solid #3c3c3c' }}
        >
          <span className="font-semibold text-sm" style={{ color: '#cccccc' }}>Docs</span>
          <div className="flex-1" />
          {/* Full-width toggle — handy on phone landscape to use the whole screen */}
          <button
            onClick={() => setFullWidth(w => !w)}
            title={fullWidth ? 'Restore panel width' : 'Expand to full width'}
            className="leading-none px-1 rounded transition-colors mr-1"
            style={{ color: '#888' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ccc'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
          >
            {fullWidth ? <RestoreIcon /> : <MaximizeIcon />}
          </button>
          <button
            onClick={onClose}
            className="text-lg leading-none px-1 rounded transition-colors"
            style={{ color: '#888' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ccc'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex shrink-0"
          style={{ background: '#252526', borderBottom: '1px solid #3c3c3c' }}
        >
          {(['ref', 'stl'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-xs transition-colors"
              style={{
                color: tab === t ? '#cccccc' : '#9e9e9e',
                borderBottom: tab === t ? '2px solid #0078d4' : '2px solid transparent',
                background: 'transparent',
              }}
            >
              {t === 'ref' ? 'FJ Reference' : 'Standard Library'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {tab === 'ref' && <FJReference />}
          {tab === 'stl' && <StlViewer initialSearch={open ? initialStlSearch : undefined} searchTick={open ? initialStlSearchTick : undefined} />}
        </div>
      </div>
    </>
  );
}

function FJReference() {
  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-4 text-sm"
      style={{ color: '#cccccc', lineHeight: 1.7 }}
    >
      <Section title="Core Instruction">
        <p>
          FlipJump has a single instruction: <Code>F ; J</Code>
        </p>
        <ul className="mt-2 space-y-1">
          <li><b>Flip</b> — flip (XOR with 1) the bit at memory address <Code>F</Code></li>
          <li><b>Jump</b> — unconditionally jump to address <Code>J</Code></li>
        </ul>
        <p className="mt-2" style={{ color: '#888', fontSize: 12 }}>
          Word width is <Code>@</Code> bits (typically 64). Addresses are word-aligned.
        </p>
      </Section>

      <Section title="Macro Definition">
        <Pre>{`def macroName arg1, arg2 {
    // body using arg1, arg2
    stl.output_char arg1
}`}</Pre>
        <p>Macros expand at compile time. Arguments are word-value expressions.</p>
      </Section>

      <Section title="Namespaces">
        <Pre>{`ns mylib {
    def helper {
        // ...
    }
}

// Usage:
mylib.helper`}</Pre>
      </Section>

      <Section title="Reserved Keywords">
        <p className="mb-2" style={{ color: '#888', fontSize: 12 }}>
          The assembler recognises exactly these keywords. Everything else
          (incl. <Code>output_char</Code>, <Code>startup</Code>, <Code>loop</Code>)
          is a macro defined in the standard library — invoke it as <Code>stl.name</Code>.
        </p>
        <table className="text-xs w-full mt-1" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['def name args { body }', 'Define a macro'],
              ['ns name { … }', 'Open a namespace block'],
              ['rep(n, i) macro_call', 'Repeat a macro call n times with index i'],
              ['wflip addr, value', 'Set a future jump target at compile time'],
              ['pad align', 'Pad to the next multiple of align'],
              ['segment addr', 'Set the current assembly address'],
              ['reserve n', 'Reserve n bits of space'],
            ].map(([d, desc]) => (
              <tr key={d as string} style={{ borderBottom: '1px solid #333' }}>
                <td className="pr-4 py-1"><Code>{d as string}</Code></td>
                <td style={{ color: '#999' }}>{desc as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2" style={{ color: '#888', fontSize: 12 }}>
          Predefined constants from <Code>runlib.fj</Code>: <Code>w</Code>{' '}
          (word width, set at compile time), <Code>dw = 2*w</Code>,{' '}
          <Code>dbit = w + #w</Code>.
        </p>
      </Section>

      <Section title="Numeric Literals">
        <Pre>{`0x1F     // hex
0b1010   // binary
42       // decimal`}</Pre>
      </Section>

      <Section title="Typical Program Structure">
        <Pre>{`stl.startup

stl.output_char 'H'
stl.output_char 'i'
stl.output_char '\\n'     // newline
stl.loop                  // halt`}</Pre>
      </Section>

      <Section title="Multi-File Compilation Order">
        <p className="mb-2">
          When a project has multiple <Code>.fj</Code> files they are compiled
          together in a single pass, in the order they appear in the{' '}
          <b>Explorer sidebar</b> (top → bottom).
        </p>
        <ul className="space-y-1 text-xs" style={{ color: '#999' }}>
          <li>• A file can only use macros / namespaces defined in itself or in files that appear <em>earlier</em> in the list.</li>
          <li>• Drag &amp; drop files in the Explorer to change the compilation order.</li>
          <li>• The first file is compiled first; its <Code>stl.startup</Code> call initialises the runtime.</li>
        </ul>
      </Section>

      <Section title="Common STL Macros">
        <table className="text-xs w-full mt-1" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['stl.startup', 'Boot the program — must be the first executable code'],
              ["stl.output_char 'H'", "Output one byte. Char literals support '\\n', '\\t', '\\\\', etc. Numeric bytes (10, 0x0a) also work"],
              ['stl.output "str"', 'Output a constant string of bytes (no escape sequences inside strings)'],
              ['stl.loop', 'Halt by looping in place'],
              ['stl.skip', 'No-op (skip the next flip-jump instruction)'],
              ['bit.input dst', 'Read one byte from stdin into a bit-vector variable'],
              ['hex.input dst', 'Read one byte from stdin into a hex variable'],
            ].map(([m, desc]) => (
              <tr key={m as string} style={{ borderBottom: '1px solid #333' }}>
                <td className="pr-4 py-1"><Code>{m as string}</Code></td>
                <td style={{ color: '#999' }}>{desc as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2" style={{ color: '#888', fontSize: 12 }}>
          Browse the full STL in the <b>Standard Library</b> tab.
        </p>
      </Section>

      <Section title="External Links">
        <ul className="space-y-1">
          <li>
            <a
              href="https://github.com/tomhea/flip-jump/wiki"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#569cd6' }}
            >
              FlipJump Wiki (language reference, tutorials) ↗
            </a>
          </li>
          <li>
            <a
              href="https://esolangs.org/wiki/FlipJump"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#569cd6' }}
            >
              FlipJump on Esolangs Wiki ↗
            </a>
          </li>
          <li>
            <a
              href="https://github.com/tomhea/flip-jump"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#569cd6' }}
            >
              GitHub: tomhea/flip-jump ↗
            </a>
          </li>
        </ul>
      </Section>
    </div>
  );
}

function MaximizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 2h5M2 2v5M14 2h-5M14 2v5M2 14h5M2 14v-5M14 14h-5M14 14v-5" strokeLinecap="round" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 2H2v3M2 2l4 4M11 2h3v3M14 2l-4 4M5 14H2v-3M2 14l4-4M11 14h3v-3M14 14l-4-4" strokeLinecap="round" />
    </svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="font-semibold mb-2 text-sm" style={{ color: '#e8c47a' }}>{title}</h2>
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="px-1 rounded text-xs"
      style={{ background: '#2d2d2d', color: '#9cdcfe', fontFamily: 'Consolas, monospace' }}
    >
      {children}
    </code>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre
      className="rounded px-3 py-2 text-xs overflow-x-auto"
      style={{ background: '#252526', color: '#d4d4d4', fontFamily: 'Consolas, monospace', lineHeight: 1.6 }}
    >
      {children}
    </pre>
  );
}
