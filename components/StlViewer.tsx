'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { OnMount } from '@monaco-editor/react';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface StlEntry {
  path: string;
  name: string;
  dir: string;
}

interface StlIndex {
  files: StlEntry[];
  dirs: string[];
}

function languageForStl(name: string): string {
  if (name === 'README.md') return 'markdown';
  return 'flipjump';
}

export default function StlViewer() {
  const [index, setIndex] = useState<StlIndex | null>(null);
  const [selected, setSelected] = useState<StlEntry | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/stl-index.json')
      .then(r => r.ok ? r.json() : null)
      .then((data: StlIndex | null) => setIndex(data))
      .catch(() => setIndex(null));
  }, []);

  async function selectFile(entry: StlEntry) {
    setSelected(entry);
    setLoading(true);
    try {
      const res = await fetch(`/stl/${entry.path}`);
      setContent(res.ok ? await res.text() : `// Failed to load ${entry.path}`);
    } catch {
      setContent(`// Failed to load ${entry.path}`);
    } finally {
      setLoading(false);
    }
  }

  function toggleDir(dir: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir); else next.add(dir);
      return next;
    });
  }

  if (!index) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm" style={{ color: '#666' }}>
        {index === null ? 'STL not available. Run npm run dev to fetch it.' : 'Loading…'}
      </div>
    );
  }

  // Group files by directory
  const rootFiles = index.files.filter(f => f.dir === '');
  const dirMap: Record<string, StlEntry[]> = {};
  for (const f of index.files) {
    if (f.dir) {
      if (!dirMap[f.dir]) dirMap[f.dir] = [];
      dirMap[f.dir].push(f);
    }
  }

  // Top-level dirs only (not nested sub-dirs as separate groups)
  const topDirs = [...new Set(index.dirs.map(d => d.split('/')[0]))].sort();

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* File tree */}
      <div
        className="flex flex-col overflow-y-auto shrink-0"
        style={{ width: 180, borderRight: '1px solid #3c3c3c', background: '#252526' }}
      >
        <FileGroup
          entries={rootFiles}
          selected={selected}
          onSelect={selectFile}
        />
        {topDirs.map(dir => (
          <DirGroup
            key={dir}
            dir={dir}
            allEntries={index.files}
            selected={selected}
            collapsed={collapsed}
            onToggle={toggleDir}
            onSelect={selectFile}
          />
        ))}
      </div>

      {/* Editor pane */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0" style={{ background: '#1e1e1e' }}>
        {selected ? (
          <>
            <div
              className="px-3 py-1 text-xs shrink-0"
              style={{ color: '#888', borderBottom: '1px solid #3c3c3c', background: '#252526' }}
            >
              {selected.path}
              <span className="ml-2" style={{ color: '#555' }}>
                {languageForStl(selected.name) === 'markdown' ? '— Markdown' : '— FlipJump'}
              </span>
            </div>
            {loading ? (
              <div className="flex-1 flex items-center justify-center" style={{ color: '#555', fontSize: 12 }}>
                Loading…
              </div>
            ) : (
              <MonacoEditor
                key={selected.path}
                height="100%"
                language={languageForStl(selected.name)}
                theme="fj-dark"
                value={content}
                options={{
                  readOnly: true,
                  fontSize: 13,
                  fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  automaticLayout: true,
                  folding: true,
                  wordWrap: languageForStl(selected.name) === 'markdown' ? 'on' : 'off',
                }}
                onMount={(_editor, monaco: Parameters<OnMount>[1]) => {
                  // Ensure theme is applied
                  monaco.editor.setTheme('fj-dark');
                }}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: '#555' }}>
            Select a file from the tree to view it
          </div>
        )}
      </div>
    </div>
  );
}

function FileGroup({
  entries, selected, onSelect,
}: {
  entries: StlEntry[];
  selected: StlEntry | null;
  onSelect: (e: StlEntry) => void;
}) {
  // Show README.md first, then .fj files
  const readmes = entries.filter(f => f.name === 'README.md');
  const fj = entries.filter(f => f.name !== 'README.md');
  return (
    <>
      {[...readmes, ...fj].map(f => (
        <FileItem key={f.path} entry={f} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );
}

function DirGroup({
  dir, allEntries, selected, collapsed, onToggle, onSelect,
}: {
  dir: string;
  allEntries: StlEntry[];
  selected: StlEntry | null;
  collapsed: Set<string>;
  onToggle: (d: string) => void;
  onSelect: (e: StlEntry) => void;
}) {
  const isOpen = !collapsed.has(dir);
  // Get entries that belong to this dir tree
  const entries = allEntries.filter(f => f.dir === dir || f.dir.startsWith(dir + '/'));
  const directEntries = entries.filter(f => f.dir === dir);
  const subDirs = [...new Set(
    entries.filter(f => f.dir !== dir).map(f => f.dir.split('/').slice(0, dir.split('/').length + 1).join('/'))
  )].sort();

  const readmes = directEntries.filter(f => f.name === 'README.md');
  const fj = directEntries.filter(f => f.name !== 'README.md');

  return (
    <div>
      <button
        onClick={() => onToggle(dir)}
        className="flex items-center gap-1 w-full text-left px-2 py-0.5 text-xs"
        style={{ color: '#cccccc', background: 'transparent' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2a2d2e'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <span style={{ color: '#888', fontSize: 10 }}>{isOpen ? '▼' : '▶'}</span>
        <FolderIcon />
        <span>{dir.split('/').pop()}</span>
      </button>
      {isOpen && (
        <div style={{ paddingLeft: 12 }}>
          {[...readmes, ...fj].map(f => (
            <FileItem key={f.path} entry={f} selected={selected} onSelect={onSelect} />
          ))}
          {subDirs.map(sd => (
            <DirGroup
              key={sd}
              dir={sd}
              allEntries={allEntries}
              selected={selected}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileItem({ entry, selected, onSelect }: {
  entry: StlEntry;
  selected: StlEntry | null;
  onSelect: (e: StlEntry) => void;
}) {
  const isActive = selected?.path === entry.path;
  const isReadme = entry.name === 'README.md';
  return (
    <div
      onClick={() => onSelect(entry)}
      className="flex items-center gap-1 px-2 py-0.5 cursor-pointer text-xs truncate"
      style={{
        background: isActive ? '#094771' : 'transparent',
        color: isActive ? '#fff' : '#cccccc',
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#2a2d2e'; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      {isReadme ? <ReadmeIcon /> : <FjFileIcon />}
      <span className="truncate">{entry.name}</span>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#e8c47a" strokeWidth="1.2">
      <path d="M1 4h5l2 2h7v8H1V4z" />
    </svg>
  );
}

function FjFileIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 2h7l4 4v8H3V2z" stroke="#73c991" strokeWidth="1.2" />
      <path d="M10 2v4h4" stroke="#73c991" strokeWidth="1.2" />
    </svg>
  );
}

function ReadmeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
      <path d="M2 2h12v12H2V2z" stroke="#569cd6" strokeWidth="1.2" />
      <path d="M5 5h6M5 8h6M5 11h4" stroke="#569cd6" strokeWidth="1" />
    </svg>
  );
}
