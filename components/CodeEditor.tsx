'use client';

import { useEffect, useRef } from 'react';
import { FJFile, MonacoMarker } from '@/lib/types';
import dynamic from 'next/dynamic';
import type { OnMount } from '@monaco-editor/react';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface CodeEditorProps {
  file: FJFile | undefined;
  onChange: (content: string) => void;
  markers?: MonacoMarker[];
  readOnly?: boolean;
  overrideLanguage?: string;
  /** Called when the user Ctrl+clicks a word — fires with the clicked word. */
  onCtrlClick?: (word: string) => void;
}

type MonacoInstance = Parameters<OnMount>[1];

function languageForFile(name: string, override?: string): string {
  if (override) return override;
  if (name.endsWith('.fj')) return 'flipjump';
  if (name.endsWith('.bf') || name.endsWith('.b')) return 'brainfuck';
  if (name.endsWith('.c') || name.endsWith('.cpp') || name.endsWith('.h')) return 'c';
  if (name.endsWith('.md')) return 'markdown';
  return 'plaintext';
}

export default function CodeEditor({ file, onChange, markers, readOnly, overrideLanguage, onCtrlClick }: CodeEditorProps) {
  const monacoRef = useRef<MonacoInstance | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const onCtrlClickRef = useRef(onCtrlClick);
  // Keep the ref in sync with the latest prop value without mutating it during
  // render (which triggers react-hooks/refs).  The ref is only read in event
  // handlers so a one-render lag is harmless.
  useEffect(() => { onCtrlClickRef.current = onCtrlClick; });

  const handleMount: OnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;
    registerLanguages(monaco);

    // Ctrl+click fires onCtrlClick with the word under the cursor.
    editor.onMouseDown((e) => {
      if (!e.event.ctrlKey && !e.event.metaKey) return;
      const pos = e.target.position;
      if (!pos) return;
      const model = editor.getModel();
      if (!model) return;
      const wordInfo = model.getWordAtPosition(pos);
      if (wordInfo?.word) {
        onCtrlClickRef.current?.(wordInfo.word);
      }
    });
  };

  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor || !file) return;

    const model = editor.getModel();
    if (!model) return;

    if (!markers?.length) {
      monaco.editor.setModelMarkers(model, 'fj-compiler', []);
      return;
    }

    const monacoMarkers = markers
      .filter(m => m.filename === file.name)
      .map(m => ({
        severity: monaco.MarkerSeverity.Error,
        startLineNumber: m.startLine,
        startColumn: m.startCol,
        endLineNumber: m.endLine ?? m.startLine,
        // Monaco clamps to actual line length, so passing a very large
        // sentinel means "extend the squiggle to end of line".
        endColumn: m.endCol ?? Number.MAX_SAFE_INTEGER,
        message: m.message,
        source: 'fj-compiler',
      }));
    monaco.editor.setModelMarkers(model, 'fj-compiler', monacoMarkers);
  }, [markers, file]);

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

  const lang = languageForFile(file.name, overrideLanguage);

  return (
    <div className="flex-1 min-h-0" style={{ background: '#1e1e1e' }}>
      <MonacoEditor
        key={file.id}
        height="100%"
        language={lang}
        theme="fj-dark"
        value={file.content}
        onChange={(val) => { if (!readOnly) onChange(val ?? ''); }}
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
          readOnly: readOnly ?? false,
        }}
      />
    </div>
  );
}

function registerLanguages(monaco: MonacoInstance) {
  registerFlipJumpLanguage(monaco);
  registerBrainfuckLanguage(monaco);
}

function registerFlipJumpLanguage(monaco: MonacoInstance) {
  if (monaco.languages.getLanguages().find((l: { id: string }) => l.id === 'flipjump')) return;

  monaco.languages.register({ id: 'flipjump', extensions: ['.fj'], aliases: ['FlipJump', 'flipjump'] });

  monaco.languages.setMonarchTokensProvider('flipjump', {
    defaultToken: '',
    tokenPostfix: '.fj',

    keywords:   ['ns', 'rep'],
    types:      ['dbit', 'dw', 'w'],
    directives: ['pad', 'reserve', 'segment', 'wflip'],

    tokenizer: {
      root: [
        // Line comment: // only
        [/\/\/.*$/, 'comment'],

        // def keyword → next identifier is the macro name
        [/\bdef\b/, { token: 'keyword', next: '@afterDef' }],

        // Labels: identifier immediately before ':'
        [/[A-Za-z_][\w.]*(?=\s*:)/, 'type'],

        // Constants: identifier immediately before '='  (strict: no dots)
        [/[A-Za-z_]\w*(?=\s*=)/, 'variable.constant'],

        // Macro calls: the FIRST identifier on a line (after optional leading whitespace).
        // NOTE on `^`: Monarch's `^` is a *line-start guard*, not a standard JS regex
        // anchor.  The engine evaluates rules that begin with `^` ONLY when the
        // tokenizer is at position 0 of the line; they are skipped entirely once any
        // character has been consumed.  This is what prevents argument identifiers
        // later on the same line from ever being coloured as macro calls.
        // Leading whitespace is absorbed by capture group 1 (token ''), so the
        // identifier in group 2 still starts at an arbitrary column.
        // Keywords, types, and directives are excluded via a negative lookahead.
        // Examples matched: stl.output_char 'H', bit.add w, a, b, stl.loop, .startup, myMacro
        [/^([ \t]*)((?!(?:def|ns|rep|pad|reserve|segment|wflip|dbit|dw|w)\b)[A-Za-z_.][\w.]*(?=[ \t]+[^;\s\/]|[ \t]*(?:\/\/|$)))/, ['', 'macro.call']],

        // Identifiers: keywords, types, directives, or plain identifiers (allow dots for namespaces)
        [/[A-Za-z_][\w.]*/, {
          cases: {
            '@keywords':   'keyword',
            '@types':      'type',
            '@directives': 'keyword.control',
            '@default':    'identifier',
          },
        }],

        // ; is the flip-jump separator (keywords3)
        [/;/, 'keyword.control'],
        // , is keywords1
        [/,/, 'keyword'],

        // Numbers
        [/0x[0-9a-fA-F]+/, 'number.hex'],
        [/0b[01]+/, 'number'],
        [/\d+/, 'number'],

        // Strings
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*'/, 'string'],

        // Operators (keywords4)
        [/[!=<>?@^|%&*+\-/:#]/, 'operator'],

        // Brackets
        [/[()[\]{}]/, 'delimiter.bracket'],
      ],

      // State entered after 'def': color the following identifier as macro name
      afterDef: [
        [/\s+/, ''],
        [/[A-Za-z_]\w*/, { token: 'entity.name.function', next: '@pop' }],
        [/./, { token: '', next: '@pop' }],
      ],
    },
  });

  monaco.editor.defineTheme('fj-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',              foreground: '6a9955', fontStyle: 'italic' },
      { token: 'keyword',              foreground: '569cd6', fontStyle: 'bold' },  // def ns rep ,
      { token: 'type',                 foreground: '4ec9b0' },                     // labels + dbit dw w
      { token: 'keyword.control',      foreground: 'e07b39' },                     // pad reserve segment wflip ;
      { token: 'entity.name.function', foreground: '56c8c8' },                     // macro name after def
      { token: 'variable.constant',    foreground: 'c792ea' },                     // constant LHS (name = value)
      { token: 'macro.call',           foreground: 'e8c47a' },                     // macro invocation (identifier before args)
      { token: 'number',               foreground: 'b5cea8' },
      { token: 'number.hex',           foreground: 'b5cea8' },
      { token: 'string',               foreground: 'ce9178' },
      { token: 'identifier',           foreground: '9cdcfe' },
      { token: 'operator',             foreground: 'd4d4d4' },
      { token: 'delimiter.bracket',    foreground: 'd4d4d4' },
    ],
    colors: {
      'editor.background':            '#1e1e1e',
      'editor.foreground':            '#d4d4d4',
      'editorLineNumber.foreground':  '#858585',
      'editorCursor.foreground':      '#aeafad',
      'editor.selectionBackground':   '#264f78',
      'editor.lineHighlightBackground': '#2a2a2a',
    },
  });

  monaco.editor.setTheme('fj-dark');
}

function registerBrainfuckLanguage(monaco: MonacoInstance) {
  if (monaco.languages.getLanguages().find((l: { id: string }) => l.id === 'brainfuck')) return;

  monaco.languages.register({ id: 'brainfuck', extensions: ['.bf', '.b'], aliases: ['Brainfuck', 'brainfuck'] });

  monaco.languages.setMonarchTokensProvider('brainfuck', {
    defaultToken: 'comment',
    tokenizer: {
      root: [
        [/[+\-]/, 'number'],
        [/[<>]/, 'keyword'],
        [/[[\]]/, 'delimiter.bracket'],
        [/[.,]/, 'string'],
      ],
    },
  });
}
