'use client';

import { useState, useRef, useEffect } from 'react';
import { FJFile } from '@/lib/types';

interface FileTreeProps {
  files: FJFile[];
  activeFileId: string;
  onSelectFile: (id: string) => void;
  onCreateFile: (name: string) => void;
  onRenameFile: (id: string, name: string) => void;
  onDeleteFile: (id: string) => void;
}

export default function FileTree({
  files, activeFileId,
  onSelectFile, onCreateFile, onRenameFile, onDeleteFile,
}: FileTreeProps) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  function startRename(file: FJFile) {
    setEditingId(file.id);
    setEditValue(file.name);
  }

  function startNew() {
    setEditingId('new');
    setEditValue('untitled.fj');
  }

  function commitEdit() {
    if (!editValue.trim()) { cancelEdit(); return; }
    const name = editValue.trim().endsWith('.fj') ? editValue.trim() : editValue.trim() + '.fj';
    if (editingId === 'new') {
      onCreateFile(name);
    } else if (editingId) {
      onRenameFile(editingId, name);
    }
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
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

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{ width: 200, background: '#252526', borderRight: '1px solid #3c3c3c' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1 text-xs uppercase tracking-widest"
        style={{ color: '#bbbbbb', borderBottom: '1px solid #3c3c3c', minHeight: 32 }}
      >
        <span>Explorer</span>
        <button
          onClick={startNew}
          title="New file"
          className="rounded p-0.5 hover:bg-zinc-600 transition-colors"
          style={{ lineHeight: 1 }}
        >
          <PlusIcon />
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.map((file) => (
          <div key={file.id}>
            {editingId === file.id ? (
              <div className="px-2 py-0.5">
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={commitEdit}
                  className="w-full px-1 text-xs rounded outline-none"
                  style={{ background: '#3c3c3c', color: '#cccccc', border: '1px solid #0078d4' }}
                />
              </div>
            ) : (
              <div
                onClick={() => onSelectFile(file.id)}
                onDoubleClick={() => startRename(file)}
                onContextMenu={(e) => handleContextMenu(e, file.id)}
                className="flex items-center gap-1.5 px-3 py-0.5 cursor-pointer text-xs truncate transition-colors"
                style={{
                  background: file.id === activeFileId ? '#094771' : 'transparent',
                  color: file.id === activeFileId ? '#ffffff' : '#cccccc',
                }}
                onMouseEnter={(e) => {
                  if (file.id !== activeFileId)
                    (e.currentTarget as HTMLDivElement).style.background = '#2a2d2e';
                }}
                onMouseLeave={(e) => {
                  if (file.id !== activeFileId)
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                <FjFileIcon active={file.id === activeFileId} />
                <span className="truncate">{file.name}</span>
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
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitEdit}
              className="w-full px-1 text-xs rounded outline-none"
              style={{ background: '#3c3c3c', color: '#cccccc', border: '1px solid #0078d4' }}
            />
          </div>
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
              if (files.length === 1) return; // don't delete last file
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
        stroke={active ? '#73c991' : '#73c991'}
        strokeWidth="1.2"
        fill={active ? '#1e3a2a' : 'transparent'}
      />
      <path d="M10 2v4h4" stroke={active ? '#73c991' : '#73c991'} strokeWidth="1.2" />
    </svg>
  );
}
