'use client';

import { useState, useRef, useEffect } from 'react';
import { FJFile, SourceFile } from '@/lib/types';

interface FileTreeProps {
  files: FJFile[];
  activeFileId: string;
  sources: SourceFile[];
  activeSourceIdx: number | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelectFile: (id: string) => void;
  onSelectSource: (idx: number) => void;
  onCreateFile: (name: string) => void;
  onRenameFile: (id: string, name: string) => void;
  onDeleteFile: (id: string) => void;
  onDeleteSource: (idx: number) => void;
  /** Callback fired when the user drags a FJ file to a new position. */
  onReorderFiles: (files: FJFile[]) => void;
  /** When true the tree stretches to fill its flex parent (used in the mobile drawer). */
  fullWidth?: boolean;
}

export default function FileTree({
  files, activeFileId,
  sources, activeSourceIdx,
  collapsed, onToggleCollapsed,
  onSelectFile, onSelectSource,
  onCreateFile, onRenameFile, onDeleteFile,
  onDeleteSource, onReorderFiles,
  fullWidth = false,
}: FileTreeProps) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Drag-and-drop reorder state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // 'end' means the drop-after-last sentinel is hovered
  const [dragOverEnd, setDragOverEnd] = useState(false);
  // Hover state for file delete button
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  // Hover state for source delete button
  const [hoveredSourceIdx, setHoveredSourceIdx] = useState<number | null>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  // Reorder files: move the dragged file so it appears before the drop target.
  function handleFileDrop(targetId: string) {
    const fromIdx = files.findIndex((f) => f.id === draggedId);
    const toIdx = files.findIndex((f) => f.id === targetId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    const next = [...files];
    const [item] = next.splice(fromIdx, 1);
    // After removing fromIdx, if the target was to the right it shifted left by 1.
    const insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
    next.splice(insertAt, 0, item);
    onReorderFiles(next);
  }

  // Reorder files: move the dragged file to the very end.
  function handleFileDropEnd() {
    const fromIdx = files.findIndex((f) => f.id === draggedId);
    if (fromIdx < 0 || fromIdx === files.length - 1) return;
    const next = [...files];
    const [item] = next.splice(fromIdx, 1);
    next.push(item);
    onReorderFiles(next);
  }

  function startRename(file: FJFile) {
    setEditingId(file.id);
    setEditValue(file.name);
    setEditError(null);
  }

  function startNew() {
    setEditingId('new');
    setEditValue('untitled.fj');
    setEditError(null);
  }

  function commitEdit() {
    if (!editValue.trim()) {
      cancelEdit();
      return;
    }
    const trimmed = editValue.trim();
    const name = trimmed.endsWith('.fj') ? trimmed : trimmed + '.fj';
    // Reject duplicates so two files with the same name can't collide on
    // the server tempdir (where they'd overwrite each other).
    const collision = files.some(
      (f) => f.name.toLowerCase() === name.toLowerCase() && f.id !== editingId,
    );
    if (collision) {
      setEditError(`A file named "${name}" already exists.`);
      return; // keep input open so the user can fix the name
    }
    if (editingId === 'new') {
      onCreateFile(name);
    } else if (editingId) {
      onRenameFile(editingId, name);
    }
    setEditingId(null);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') cancelEdit();
  }

  function handleContextMenu(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  }

  if (collapsed) {
    return (
      <div
        className="flex flex-col shrink-0 items-center"
        style={{ width: 32, background: '#252526', borderRight: '1px solid #3c3c3c' }}
      >
        <button
          onClick={onToggleCollapsed}
          title="Show Explorer"
          className="p-1.5 mt-1 rounded hover:bg-zinc-600 transition-colors"
          aria-label="Show file tree"
        >
          <CollapseIcon collapsed />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col overflow-hidden ${fullWidth ? 'flex-1' : 'shrink-0'}`}
      style={{ width: fullWidth ? '100%' : 200, background: '#252526', borderRight: '1px solid #3c3c3c' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1 text-xs uppercase tracking-widest"
        style={{ color: '#bbbbbb', borderBottom: '1px solid #3c3c3c', minHeight: 32 }}
      >
        <span>Explorer</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={startNew}
            title="New file"
            className="rounded p-0.5 hover:bg-zinc-600 transition-colors"
            style={{ lineHeight: 1 }}
          >
            <PlusIcon />
          </button>
          <button
            onClick={onToggleCollapsed}
            title="Hide Explorer"
            className="rounded p-0.5 hover:bg-zinc-600 transition-colors"
            style={{ lineHeight: 1 }}
            aria-label="Hide file tree"
          >
            <CollapseIcon />
          </button>
        </div>
      </div>

      {/* FJ File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.map((file) => (
          <div key={file.id}>
            {editingId === file.id ? (
              <div className="px-2 py-0.5">
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => { setEditValue(e.target.value); setEditError(null); }}
                  onKeyDown={handleKeyDown}
                  onBlur={commitEdit}
                  className="w-full px-1 text-xs rounded outline-none"
                  style={{ background: '#3c3c3c', color: '#cccccc', border: `1px solid ${editError ? '#f44747' : '#0078d4'}` }}
                />
                {editError && (
                  <div className="mt-0.5 text-xs" style={{ color: '#f44747' }}>{editError}</div>
                )}
              </div>
            ) : (
              <div
                draggable
                onClick={() => onSelectFile(file.id)}
                onDoubleClick={() => startRename(file)}
                onContextMenu={(e) => handleContextMenu(e, file.id)}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', file.id);
                  setDraggedId(file.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverId !== file.id) setDragOverId(file.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileDrop(file.id);
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                onDragLeave={() => setDragOverId(null)}
                onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                className="flex items-center gap-1 px-3 py-0.5 cursor-pointer text-xs transition-colors"
                style={{
                  background: file.id === activeFileId && activeSourceIdx === null ? '#094771' : 'transparent',
                  color: file.id === activeFileId && activeSourceIdx === null ? '#ffffff'
                    : draggedId === file.id ? '#555' : '#cccccc',
                  opacity: draggedId === file.id ? 0.4 : 1,
                  borderTop: dragOverId === file.id && draggedId !== file.id
                    ? '2px solid #0078d4' : '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  setHoveredFileId(file.id);
                  if (!(file.id === activeFileId && activeSourceIdx === null))
                    (e.currentTarget as HTMLDivElement).style.background = '#2a2d2e';
                }}
                onMouseLeave={(e) => {
                  setHoveredFileId(null);
                  if (!(file.id === activeFileId && activeSourceIdx === null))
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                <FjFileIcon active={file.id === activeFileId && activeSourceIdx === null} />
                <span className="truncate flex-1 min-w-0">{file.name}</span>
                {hoveredFileId === file.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(file.id);
                    }}
                    title="Delete file"
                    className="shrink-0 ml-0.5 rounded transition-colors"
                    style={{
                      color: '#888',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                      padding: '0 1px',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f44747'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* New file input */}
        {editingId === 'new' && (
          <div className="px-2 py-0.5">
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => { setEditValue(e.target.value); setEditError(null); }}
              onKeyDown={handleKeyDown}
              onBlur={commitEdit}
              className="w-full px-1 text-xs rounded outline-none"
              style={{ background: '#3c3c3c', color: '#cccccc', border: `1px solid ${editError ? '#f44747' : '#0078d4'}` }}
            />
            {editError && (
              <div className="mt-0.5 text-xs" style={{ color: '#f44747' }}>{editError}</div>
            )}
          </div>
        )}

        {/* Drop-after-last sentinel: lets users drag a file to the last position */}
        {draggedId && (
          <div
            style={{
              height: 6,
              borderTop: dragOverEnd ? '2px solid #0078d4' : '2px solid transparent',
              marginTop: 2,
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverEnd(true);
              setDragOverId(null);
            }}
            onDragLeave={() => setDragOverEnd(false)}
            onDrop={(e) => {
              e.preventDefault();
              handleFileDropEnd();
              setDraggedId(null);
              setDragOverEnd(false);
            }}
          />
        )}

        {/* Sources section */}
        {sources.length > 0 && (
          <>
            <div
              className="px-3 pt-3 pb-0.5 text-xs uppercase tracking-widest"
              style={{ color: '#9e9e9e' }}
            >
              Sources
            </div>
            {sources.map((src, idx) => (
              <div
                key={idx}
                onClick={() => onSelectSource(idx)}
                className="flex items-center gap-1.5 px-3 py-0.5 cursor-pointer text-xs"
                style={{
                  background: activeSourceIdx === idx ? '#094771' : 'transparent',
                  color: activeSourceIdx === idx ? '#fff' : '#aaaaaa',
                }}
                onMouseEnter={e => {
                  setHoveredSourceIdx(idx);
                  if (activeSourceIdx !== idx)
                    (e.currentTarget as HTMLDivElement).style.background = '#2a2d2e';
                }}
                onMouseLeave={e => {
                  setHoveredSourceIdx(null);
                  if (activeSourceIdx !== idx)
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                {src.type === 'bf' ? <BfIcon /> : <CSourceIcon />}
                <span className="truncate flex-1 min-w-0">{src.name}</span>
                <span className="shrink-0 text-xs ml-1" style={{ color: '#555', fontSize: 10 }}>
                  {src.type.toUpperCase()}
                </span>
                {hoveredSourceIdx === idx && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteSource(idx); }}
                    title="Remove source"
                    className="shrink-0 ml-1 rounded transition-colors"
                    style={{
                      color: '#888',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                      padding: '0 1px',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f44747'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded shadow-lg py-1 text-xs"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#252526',
            border: '1px solid #454545',
            minWidth: 140,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <CtxMenuItem
            label="Rename"
            onClick={() => {
              const file = files.find(f => f.id === contextMenu.id)!;
              setContextMenu(null);
              startRename(file);
            }}
          />
          <CtxMenuItem
            label="Delete"
            danger
            onClick={() => {
              onDeleteFile(contextMenu.id);
              setContextMenu(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

function CtxMenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left px-3 py-1 hover:bg-zinc-600 transition-colors"
      style={{ color: danger ? '#f44747' : '#cccccc' }}
    >
      {label}
    </button>
  );
}

function CollapseIcon({ collapsed = false }: { collapsed?: boolean }) {
  // Chevron pointing right when collapsed (click to expand), left when open.
  const d = collapsed ? "M6 4l4 4-4 4" : "M10 4l-4 4 4 4";
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#cccccc" strokeWidth="1.5">
      <path d={d} />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#cccccc" strokeWidth="1.5">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function FjFileIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 2h7l4 4v8H3V2z"
        stroke="#73c991"
        strokeWidth="1.2"
        fill={active ? '#1e3a2a' : 'transparent'}
      />
      <path d="M10 2v4h4" stroke="#73c991" strokeWidth="1.2" />
    </svg>
  );
}

function BfIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M3 2h7l4 4v8H3V2z" stroke="#b5a0e8" strokeWidth="1.2" />
      <path d="M10 2v4h4" stroke="#b5a0e8" strokeWidth="1.2" />
    </svg>
  );
}

function CSourceIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M3 2h7l4 4v8H3V2z" stroke="#5aa4e8" strokeWidth="1.2" />
      <path d="M10 2v4h4" stroke="#5aa4e8" strokeWidth="1.2" />
    </svg>
  );
}
