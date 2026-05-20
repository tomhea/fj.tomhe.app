'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CHAPTERS } from '@/lib/chapters';
import type { CodeSnippet } from '@/lib/chapters';

function CodeBlock({ snippet }: { snippet: CodeSnippet }) {
  return (
    <div
      style={{
        border: '1px solid #3c3c3c',
        borderRadius: 6,
        marginBottom: 24,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: '#252526',
          borderBottom: '1px solid #3c3c3c',
          padding: '6px 14px',
          fontSize: 12,
          color: '#569cd6',
          fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
        }}
      >
        {snippet.file}
      </div>
      <pre
        style={{
          background: '#1a1a1a',
          color: '#d4d4d4',
          margin: 0,
          padding: '16px',
          fontSize: 13,
          lineHeight: 1.65,
          overflowX: 'auto',
          fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
        }}
      >
        <code>{snippet.code}</code>
      </pre>
    </div>
  );
}

export default function Tutorial() {
  const [activeId, setActiveId] = useState(CHAPTERS[0].id);

  const activeIndex = CHAPTERS.findIndex((c) => c.id === activeId);
  const chapter = CHAPTERS[activeIndex];
  const prevChapter = CHAPTERS[activeIndex - 1] ?? null;
  const nextChapter = CHAPTERS[activeIndex + 1] ?? null;

  function goTo(id: string) {
    setActiveId(id);
    // scroll content pane to top
    const pane = document.getElementById('tutorial-content');
    if (pane) pane.scrollTop = 0;
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        overflow: 'hidden',
        background: '#1e1e1e',
        color: '#cccccc',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 15,
        lineHeight: 1.7,
      }}
    >
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <nav
        style={{
          width: 260,
          flexShrink: 0,
          background: '#252526',
          borderRight: '1px solid #3c3c3c',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #3c3c3c' }}>
          <div style={{ fontSize: 11, color: '#969696', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            FlipJump IDE
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#e8c47a', marginBottom: 12 }}>
            Learn Web Dev
          </div>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: '#4ec9b0',
              textDecoration: 'none',
              padding: '4px 8px',
              borderRadius: 4,
              background: 'rgba(78,201,176,0.08)',
            }}
          >
            ← Back to IDE
          </Link>
        </div>

        <div style={{ padding: '8px 0' }}>
          {CHAPTERS.map((c, i) => {
            const active = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => goTo(c.id)}
                style={{
                  width: '100%',
                  display: 'block',
                  textAlign: 'left',
                  padding: '10px 16px',
                  background: active ? '#094771' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: active ? '#ffffff' : '#cccccc',
                  borderLeft: active ? '3px solid #569cd6' : '3px solid transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#2a2d2e';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <div style={{ fontSize: 10, color: active ? '#9ac8f0' : '#666', marginBottom: 2 }}>
                  Chapter {i + 1}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.3 }}>{c.title}</div>
                {c.subtitle && (
                  <div style={{ fontSize: 11, color: active ? '#9ac8f0' : '#969696', marginTop: 2 }}>
                    {c.subtitle}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div
        id="tutorial-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '40px 48px',
        }}
      >
        <div style={{ maxWidth: 760 }}>
          {/* Chapter label */}
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#969696', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Chapter {activeIndex + 1} of {CHAPTERS.length}
          </p>

          {/* Title */}
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: '#e8c47a', lineHeight: 1.2 }}>
            {chapter.title}
          </h1>
          {chapter.subtitle && (
            <p style={{ margin: '0 0 36px', fontSize: 16, color: '#969696' }}>
              {chapter.subtitle}
            </p>
          )}

          {/* Body */}
          <div
            style={{
              // prose typography
            }}
          >
            {chapter.blocks.map((block, i) => {
              if (block.kind === 'code') {
                return <CodeBlock key={i} snippet={block.snippet} />;
              }
              return (
                <div
                  key={i}
                  style={{ marginBottom: 24 }}
                  className="tutorial-prose"
                >
                  {block.content}
                </div>
              );
            })}
          </div>

          {/* Navigation */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 48,
              paddingTop: 24,
              borderTop: '1px solid #3c3c3c',
            }}
          >
            <div>
              {prevChapter && (
                <button
                  onClick={() => goTo(prevChapter.id)}
                  style={{
                    padding: '10px 18px',
                    background: '#252526',
                    border: '1px solid #3c3c3c',
                    borderRadius: 6,
                    color: '#cccccc',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#2e2e2e')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#252526')}
                >
                  ← {prevChapter.title}
                </button>
              )}
            </div>
            <div>
              {nextChapter && (
                <button
                  onClick={() => goTo(nextChapter.id)}
                  style={{
                    padding: '10px 18px',
                    background: '#094771',
                    border: '1px solid #0e6298',
                    borderRadius: 6,
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#0a5a8f')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#094771')}
                >
                  {nextChapter.title} →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
