'use client';

import { useEffect, useRef } from 'react';
import { FJFile } from '@/lib/types';
import dynamic from 'next/dynamic';
import type { OnMount } from '@monaco-editor/react';

// Monaco must be loaded client-side only
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface CodeEditorProps {
  file: FJFile | undefined;
  onChange: (content: string) => void;
}

export default function CodeEditor({ file, onChange }: CodeEditorProps) {
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    registerFlipJumpLanguage(monaco);
  };

  // When the active file changes, no need to do anything special —
  // the `value` prop on MonacoEditor is controlled.

  if (!file) {
    return (
      <div
        className="flex-1 flex items-center justify-center text-sm"
        style={{ background: '#1e1e1e', color: '#969696' }}
      >
        No file selected
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0" style={{ background: '#1e1e1e' }}>
      <MonacoEditor
        key={file.id}
        height="100%"
        language="flipjump"
        theme="fj-dark"
        value={file.content}
        onChange={(val) => onChange(val ?? '')}
        onMount={handleMount}
        options={{
          fontSize: 14,
          fontFamily: "'Cascadia Code', 'Fira Code', Consolas, 'Courier New', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          folding: true,
          bracketPairColorization: { enabled: true },
          suggestOnTriggerCharacters: true,
          quickSuggestions: false,
        }}
      />
    </div>
  );
}

function registerFlipJumpLanguage(monaco: Parameters<OnMount>[1]) {
  // Avoid double-registration
  const existing = monaco.languages.getLanguages().find((l: { id: string }) => l.id === 'flipjump');
  if (existing) return;

  monaco.languages.register({ id: 'flipjump', extensions: ['.fj'], aliases: ['FlipJump', 'flipjump'] });

  monaco.languages.setMonarchTokensProvider('flipjump', {
    defaultToken: '',
    tokenPostfix: '.fj',

    keywords: [
      'wflip', 'fj', 'pad', 'rep', 'nop', 'halt', 'output', 'input',
      'startup', 'segment', 'org', 'bit', 'macro', 'end', 'def',
    ],

    operators: ['+', '-', '*', '/', '%', '<<', '>>', '&', '|', '^', '~'],

    tokenizer: {
      root: [
        // Comments
        [/\/\/.*$/, 'comment'],
        [/;.*$/, 'comment'],
        [/#.*$/, 'comment'],

        // Labels (word followed by colon)
        [/[A-Za-z_][\w.]*(?=\s*:)/, 'type'],

        // Preprocessor-style directives
        [/\.(startup|segment|org|pad|rep|bit|macro|end|def|var|reserve)\b/, 'keyword'],

        // Named keywords
        [/\b(wflip|fj|pad|rep|nop|halt|output|input)\b/, 'keyword.flow'],

        // Hex numbers
        [/\b0x[0-9a-fA-F]+\b/, 'number.hex'],

        // Binary numbers
        [/\b0b[01]+\b/, 'number'],

        // Decimal numbers
        [/\b\d+\b/, 'number'],

        // Strings
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*'/, 'string'],

        // Identifiers
        [/[A-Za-z_][\w.]*/, 'identifier'],

        // Punctuation
        [/[,;:]/, 'delimiter'],
        [/[()[\]{}]/, 'delimiter.bracket'],

        // Operators
        [/[+\-*/%&|^~<>]/, 'operator'],
      ],
    },
  });

  monaco.editor.defineTheme('fj-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
      { token: 'keyword.flow', foreground: 'c586c0' },
      { token: 'type', foreground: '4ec9b0' },           // labels
      { token: 'number', foreground: 'b5cea8' },
      { token: 'number.hex', foreground: 'b5cea8' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'identifier', foreground: '9cdcfe' },
      { token: 'operator', foreground: 'd4d4d4' },
      { token: 'delimiter', foreground: 'd4d4d4' },
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
      'editorLineNumber.foreground': '#858585',
      'editorCursor.foreground': '#aeafad',
      'editor.selectionBackground': '#264f78',
      'editor.lineHighlightBackground': '#2a2a2a',
    },
  });

  monaco.editor.setTheme('fj-dark');
}
