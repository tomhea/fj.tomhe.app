# Chapter 2 — React Components

> **Previous:** [Chapter 1 — HTML, CSS & JavaScript](01-html-css-js.md) | **Next:** [Chapter 3 — Props](03-props.md)

---

React is a JavaScript library for building user interfaces. Its central idea is the **component**: a JavaScript function that returns a piece of HTML (written as JSX).

You build a page by composing many components together, like LEGO bricks. Each component is responsible for one part of the UI.

---

## The simplest real component in this project

Here is the entire `app/page.tsx` file — the "home page" of this site:

```tsx
'use client';

import dynamic from 'next/dynamic';

// The IDE reads localStorage and URL params at mount, so there is no
// sensible server-rendered first paint. Disabling SSR eliminates the
// hydration mismatch.
const IDE = dynamic(() => import('@/components/IDE'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '100vh',
        background: '#1e1e1e',
        color: '#969696',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
      }}
    >
      Loading FlipJump IDE…
    </div>
  ),
});

export default function Home() {
  return <IDE />;
}
```

Let's break this down line by line:

- **`'use client'`** — Next.js can run components on the *server* (to generate HTML faster) or in the *browser*. This directive says "this component must run in the browser." The IDE needs the browser because it uses `localStorage` and the `window` object, which don't exist on a server.

- **`dynamic(..., { ssr: false })`** — This is a "lazy load". Instead of including the IDE in the initial page download, the browser fetches it as a separate chunk after the page loads. The `loading` prop defines what to show while it's downloading — the grey "Loading FlipJump IDE…" screen you see on first visit.

- **`export default function Home()`** — This is the component itself. It is just a JavaScript function. The `export default` makes it the "main export" of the file, which Next.js uses as the page to render at `/`.

- **`return <IDE />`** — The function returns JSX. `<IDE />` is how you *use* a component — it looks like an HTML tag but starts with a capital letter. React uses the capital letter to distinguish components from real HTML elements like `<div>` or `<p>`.

---

## The component tree

This project has 7 main components that fit together like this:

```
Home (app/page.tsx)
└── IDE (components/IDE.tsx)          ← orchestrates everything
    ├── Toolbar                        ← top button bar
    ├── FileTree                       ← left sidebar
    ├── CodeEditor                     ← the editor itself (Monaco)
    ├── Terminal                       ← bottom output panel
    └── DocsPanel                      ← right-side docs drawer
```

Each component is a separate file in the `components/` folder. The `IDE` component is the "parent" that owns all the data and passes it down to the others.

---

## What a component actually looks like

A minimal React component:

```tsx
function Greeting() {
  return <p>Hello, world!</p>;
}
```

That's it. A function, returning JSX. React calls `Greeting()`, gets back `<p>Hello, world!</p>`, and paints it on the screen.

You use it like this:

```tsx
function App() {
  return (
    <div>
      <Greeting />
      <Greeting />
    </div>
  );
}
```

Which produces:

```html
<div>
  <p>Hello, world!</p>
  <p>Hello, world!</p>
</div>
```

---

## Key takeaways

- A React component is just a function that returns JSX (HTML-like syntax).
- Component names start with a capital letter. HTML tag names don't.
- `'use client'` makes a component run in the browser, not on the server.
- `dynamic(...)` lazy-loads a component so the page can appear before heavy code downloads.
- Components compose into a tree — parents render children using `<ChildName />` syntax.

---

> **Next:** [Chapter 3 — Props: Passing Data](03-props.md)
