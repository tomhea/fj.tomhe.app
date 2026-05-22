'use client';

/**
 * Footer — sits below the IDE pane and surfaces credits / GitHub links.
 *
 * Dark-theme palette matches the IDE (see `components/Toolbar.tsx` and
 * `components/IDE.tsx`):
 *   #1e1e1e (background) · #3c3c3c (border) · #9e9e9e (muted text) · #e8c47a (accent hover)
 *
 * The wrapping `<header><IDE/></header><Footer/>` layout in `app/page.tsx`
 * uses `flex flex-col h-screen` with the IDE getting `flex-1 min-h-0` so
 * the footer takes its natural height and the IDE fills the rest.
 */
export default function Footer() {
  return (
    <footer
      className="text-xs text-center py-2 border-t shrink-0"
      style={{
        background: '#1e1e1e',
        borderColor: '#3c3c3c',
        color: '#9e9e9e',
      }}
    >
      FlipJump IDE by Tomhe ·{' '}
      <a
        href="https://github.com/tomhea/fj.tomhe.app"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
        style={{ color: '#9e9e9e' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#e8c47a'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9e9e9e'; }}
      >
        fj.tomhe.app
      </a>{' '}·{' '}
      <a
        href="https://github.com/tomhea/flip-jump"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
        style={{ color: '#9e9e9e' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#e8c47a'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9e9e9e'; }}
      >
        flip-jump
      </a>
    </footer>
  );
}
