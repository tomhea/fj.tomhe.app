'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { OnMount } from '@monaco-editor/react';
import { marked } from 'marked';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface StlEntry {
  path: string;
  name: string;
  dir: string;
  /** Full file content — included since fetch-stl.mjs v2 for content search.
   *  Optional so old cached stl-index.json files degrade gracefully. */
  content?: string;
}

interface StlIndex {
  files: StlEntry[];
  dirs: string[];
}

function languageForStl(name: string): string {
  if (name === 'README.md') return 'markdown';
  return 'flipjump';
}

export default function StlViewer({ initialSearch }: { initialSearch?: string }) {
  // undefined = still loading, null = failed to load, StlIndex = loaded
  const [index, setIndex] = useState<StlIndex | null | undefined>(undefined);
  const [selected, setSelected] = useState<StlEntry | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState(initialSearch ?? '');
  // On mobile, the sidebar collapses to an icon strip after a file is selected.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Editor ref + pending highlight query (set when a search result is clicked).
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const highlightQueryRef = useRef<string | null>(null);

  useEffect(() => {
    fetch('/stl-index.json')
      .then(r => r.ok ? r.json() : null)
      .then((data: StlIndex | null) => setIndex(data))
      .catch(() => setIndex(null));
  }, []);

  // Update search when a new initial search term arrives (Ctrl+click from editor).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialSearch !== undefined) setSearchQuery(initialSearch);
  }, [initialSearch]);

  async function selectFile(entry: StlEntry, highlight?: string) {
    highlightQueryRef.current = highlight ?? null;
    editorRef.current = null; // will be refreshed by onMount for the new key
    setSelected(entry);
    setLoading(true);
    // On mobile viewports (≤ 767px — same breakpoint used by the IDE shell)
    // collapse the sidebar so the content pane fills the screen.
    const isMobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) setSidebarCollapsed(true);
    try {
      const res = await fetch(`/stl/${entry.path}`);
      setContent(res.ok ? await res.text() : `// Failed to load ${entry.path}`);
    } catch {
      setContent(`// Failed to load ${entry.path}`);
    } finally {
      setLoading(false);
    }
  }

  // After content loads (loading → false), attempt to highlight the pending
  // search query in the Monaco editor.  Monaco renders only when !loading,
  // so onMount fires before or shortly after this effect — we check the
  // editorRef in both places and use a short delay to let Monaco finish
  // processing the initial value prop.
  useEffect(() => {
    const q = highlightQueryRef.current;
    if (loading || !content || !q || !editorRef.current) return;
    const editor = editorRef.current;
    const timer = setTimeout(() => {
      const model = editor.getModel();
      if (!model) return;
      const matches = model.findMatches(q, false, false, false, null, true);
      if (matches.length > 0) {
        editor.revealLineInCenter(matches[0].range.startLineNumber);
        editor.setSelection(matches[0].range);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [loading, content]);

  function toggleDir(dir: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir); else next.add(dir);
      return next;
    });
  }

  if (index === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm" style={{ color: '#666' }}>
        Loading…
      </div>
    );
  }
  if (index === null) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm" style={{ color: '#666' }}>
        STL not available. Run npm run dev to fetch it.
      </div>
    );
  }

  // Search filtering — flat list of all matching entries.
  // Matches filename/path first, then falls back to file content when the
  // index includes it (fetch-stl.mjs v2+). Old cached indexes without
  // `content` gracefully skip content search.
  const query = searchQuery.trim().toLowerCase();

  type SearchResult = { entry: StlEntry; snippet: string | null; };
  const searchResults: SearchResult[] | null = query
    ? index.files.flatMap((f): SearchResult[] => {
        const nameMatch =
          f.name.toLowerCase().includes(query) ||
          f.path.toLowerCase().includes(query);
        const contentSnippet =
          !nameMatch && f.content
            ? getMatchSnippet(f.content, query)
            : null;
        if (nameMatch || contentSnippet !== null) {
          return [{ entry: f, snippet: contentSnippet }];
        }
        return [];
      })
    : null;

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
      {/* File tree — collapses to ~40px icon strip on mobile after file selection */}
      <div
        className="flex flex-col shrink-0 overflow-hidden"
        style={{
          width: sidebarCollapsed ? 40 : 180,
          borderRight: '1px solid #3c3c3c',
          background: '#252526',
          transition: 'width 0.15s ease',
        }}
      >
        {/* Expand button shown when sidebar is collapsed */}
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center py-1 overflow-y-auto">
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="Expand file tree"
              className="p-2 rounded transition-colors"
              style={{ color: '#888' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ccc'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
            {/* Mini search icon — tapping it expands the sidebar */}
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="Search"
              className="p-2 rounded transition-colors"
              style={{ color: '#888' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ccc'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="6" cy="6" r="4" />
                <path d="M10 10l3 3" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            {/* Collapse button — only shown when a file is selected so user can go back to tree */}
            {selected && (
              <div className="flex items-center justify-end px-1 py-0.5 shrink-0" style={{ borderBottom: '1px solid #3c3c3c' }}>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  title="Collapse file tree"
                  className="p-0.5 rounded transition-colors"
                  style={{ color: '#666' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ccc'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#666'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M10 4l-4 4 4 4" />
                  </svg>
                </button>
              </div>
            )}
            {/* Search input */}
            <div className="px-2 py-1.5 shrink-0" style={{ borderBottom: '1px solid #3c3c3c' }}>
              <div className="flex items-center gap-1 rounded px-2 py-0.5"
                style={{ background: '#3c3c3c', border: '1px solid #555' }}
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#888" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                  <circle cx="6" cy="6" r="4" />
                  <path d="M10 10l3 3" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search STL…"
                  aria-label="Search standard library"
                  className="flex-1 outline-none bg-transparent text-xs"
                  style={{ color: '#cccccc' }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    style={{ color: '#888', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            {/* File list — scrollable */}
            <div className="flex-1 overflow-y-auto">
              {searchResults !== null ? (
                /* Flat search results */
                searchResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs" style={{ color: '#666' }}>No results</div>
                ) : (
                  searchResults.map(({ entry, snippet }) => (
                    <SearchResultItem key={entry.path} entry={entry} selected={selected} onSelect={selectFile} snippet={snippet} query={query} />
                  ))
                )
              ) : (
                /* Normal tree view */
                <>
                  <FileGroup entries={rootFiles} selected={selected} onSelect={(e) => selectFile(e)} />
                  {topDirs.map(dir => (
                    <DirGroup
                      key={dir}
                      dir={dir}
                      allEntries={index.files}
                      selected={selected}
                      collapsed={collapsed}
                      onToggle={toggleDir}
                      onSelect={(e) => selectFile(e)}
                    />
                  ))}
                </>
              )}
            </div>
          </>
        )}
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
            ) : selected.name === 'README.md' ? (
              <MarkdownPane content={content} />
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
                  wordWrap: 'off',
                }}
                onMount={(editor, monaco: Parameters<OnMount>[1]) => {
                  editorRef.current = editor;
                  monaco.editor.setTheme('fj-dark');
                  // If onMount fires after content is already loaded (common path),
                  // run the highlight here since the useEffect already fired with
                  // a null editorRef.
                  const q = highlightQueryRef.current;
                  if (q) {
                    setTimeout(() => {
                      const model = editor.getModel();
                      if (!model) return;
                      const matches = model.findMatches(q, false, false, false, null, true);
                      if (matches.length > 0) {
                        editor.revealLineInCenter(matches[0].range.startLineNumber);
                        editor.setSelection(matches[0].range);
                      }
                    }, 100);
                  }
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

/** Renders a markdown README.md as formatted HTML using marked. */
function MarkdownPane({ content }: { content: string }) {
  const html = useMemo(() => {
    try {
      return marked.parse(content, { async: false }) as string;
    } catch {
      return `<pre>${content}</pre>`;
    }
  }, [content]);

  return (
    <div
      className="stl-markdown flex-1 overflow-y-auto px-5 py-4"
      // dangerouslySetInnerHTML is safe here: this content comes from the
      // FlipJump STL repository (a known-good source), not user input.
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ color: '#cccccc', lineHeight: 1.7, fontSize: 13 }}
    />
  );
}

function SearchResultItem({ entry, selected, onSelect, snippet, query }: {
  entry: StlEntry;
  selected: StlEntry | null;
  onSelect: (e: StlEntry, highlight?: string) => void;
  /** A short excerpt of the matching line when the match came from file content. */
  snippet: string | null;
  /** The active search query — passed to onSelect so Monaco can jump to first match. */
  query: string;
}) {
  const isActive = selected?.path === entry.path;
  function activate() { onSelect(entry, query || undefined); }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } }}
      className="flex flex-col px-2 py-0.5 cursor-pointer text-xs"
      style={{
        background: isActive ? '#094771' : 'transparent',
        color: isActive ? '#fff' : '#cccccc',
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#2a2d2e'; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      <span className="truncate">{entry.name}</span>
      {entry.dir && (
        <span className="truncate" style={{ color: isActive ? '#aad3f5' : '#666', fontSize: 10 }}>
          {entry.dir}
        </span>
      )}
      {snippet && (
        <span className="truncate font-mono" style={{ color: isActive ? '#aad3f5' : '#888', fontSize: 10 }}>
          {snippet}
        </span>
      )}
    </div>
  );
}

/** Returns the first line of `content` that contains `query` (case-insensitive),
 *  trimmed and capped at 60 chars. Returns null if no match. */
function getMatchSnippet(content: string, query: string): string | null {
  const q = query.toLowerCase();
  for (const line of content.split('\n')) {
    if (line.toLowerCase().includes(q)) {
      const trimmed = line.trim();
      return trimmed.length > 60 ? trimmed.slice(0, 60) + '…' : trimmed;
    }
  }
  return null;
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
        style={{ color: '#cccccc', background: 'transparent', flexShrink: 0 }}
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
        // flex-shrink:0 prevents the item from collapsing when the file tree
        // flex container is squeezed (bug: first few items squashed to ~1px).
        flexShrink: 0,
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
