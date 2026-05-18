'use client';

import { useEffect, useState } from 'react';
import StlViewer from './StlViewer';

interface DocsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function DocsPanel({ open, onClose }: DocsPanelProps) {
  const [tab, setTab] = useState<'ref' | 'stl'>('ref');

  // Close on Escape when the panel is open. Full focus trapping is left
  // for a follow-up (would justify pulling in @radix-ui/react-dialog).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Documentation"
        aria-hidden={!open}
        style={{
          width: 'clamp(400px, 42vw, 700px)',
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
                color: tab === t ? '#cccccc' : '#666',
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
          {tab === 'stl' && <StlViewer />}
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
        <Pre>{`def macroName(arg1, arg2):
    // body using arg1, arg2
    output arg1
    halt`}</Pre>
        <p>Macros expand at compile time. Arguments are word-value expressions.</p>
      </Section>

      <Section title="Namespaces">
        <Pre>{`ns mylib

def helper:
    ...

ns           // closes mylib

// Usage:
mylib.helper`}</Pre>
      </Section>

      <Section title="Directives">
        <table className="text-xs w-full mt-1" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['.startup <label>', 'Set the program entry point'],
              ['segment <addr>', 'Set current assembly address'],
              ['pad <align>', 'Align to next multiple of <align>'],
              ['reserve <n>', 'Reserve <n> words of space'],
              ['wflip <addr>, <val>', 'Set a jump target at compile time'],
              ['rep <n>, <macro>', 'Repeat macro call n times'],
              ['dbit <name>', 'Declare a 1-bit variable'],
              ['dw <name>', 'Declare a word variable'],
            ].map(([d, desc]) => (
              <tr key={d as string} style={{ borderBottom: '1px solid #333' }}>
                <td className="pr-4 py-1"><Code>{d as string}</Code></td>
                <td style={{ color: '#999' }}>{desc as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Numeric Literals">
        <Pre>{`0x1F     // hex
0b1010   // binary
42       // decimal`}</Pre>
      </Section>

      <Section title="Typical Program Structure">
        <Pre>{`.startup main

main:
    output 'H'
    output 'i'
    output '\\n'
    halt`}</Pre>
      </Section>

      <Section title="Common STL Macros">
        <table className="text-xs w-full mt-1" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['output <char>', 'Output a character literal or variable'],
              ['input <dst>', 'Read one byte from stdin into variable'],
              ['halt', 'Terminate the program'],
              ['nop', 'No operation (skip)'],
            ].map(([m, desc]) => (
              <tr key={m as string} style={{ borderBottom: '1px solid #333' }}>
                <td className="pr-4 py-1"><Code>{m as string}</Code></td>
                <td style={{ color: '#999' }}>{desc as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="External Links">
        <ul className="space-y-1">
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="font-semibold mb-2 text-sm" style={{ color: '#e8c47a' }}>{title}</h3>
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
