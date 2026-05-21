# Chapter 1 — The Web: HTML, CSS & JavaScript

> **Previous:** — | **Next:** [Chapter 2 — React Components](02-react-components.md)

---

Every website you have ever visited is made of three things working together:

- **HTML** — the *structure*. It describes what is on the page: headings, paragraphs, buttons, images.
- **CSS** — the *appearance*. It controls colors, sizes, layout, and fonts.
- **JavaScript** — the *behaviour*. It makes things interactive: clicking a button, loading data, updating the screen without a full page reload.

When you visit a website, your browser downloads these three and assembles them into what you see.

---

## The HTML shell of this IDE

Every Next.js app has a *root layout* — a file that produces the outermost HTML structure. Here is ours (`app/layout.tsx`):

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ height: '100%', margin: 0 }}>{children}</body>
    </html>
  );
}
```

This looks like HTML, but it is actually **JSX** — a JavaScript syntax that lets you write HTML-like tags inside JavaScript code. The browser never sees JSX directly; Next.js translates it into real HTML before sending it.

Notice `{children}`. That is a *slot* — every page of the app is inserted here. Think of it as a picture frame: the frame (layout) stays constant, the picture (page content) swaps out.

---

## CSS: making things look right

This IDE has a dark "VS Code" theme. All the colours are defined as **CSS variables** in `app/globals.css`:

```css
:root {
  /* Backgrounds */
  --ide-bg:           #1e1e1e;
  --ide-panel-bg:     #252526;
  --ide-toolbar-bg:   #323233;

  /* Text */
  --ide-text:         #cccccc;
  --ide-text-muted:   #969696;

  /* Accent colors */
  --ide-green:        #73c991;
  --ide-teal:         #4ec9b0;
  --ide-yellow:       #e8c47a;
  --ide-red:          #f44747;
  --ide-blue:         #569cd6;
}

html, body {
  height: 100%;
  overflow: hidden;
  background-color: var(--ide-bg);
  color: var(--ide-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

CSS variables (written as `--name: value`) are like constants in a programming language. Once you define `--ide-bg: #1e1e1e`, you can write `var(--ide-bg)` anywhere in your CSS — and changing the variable updates every element that uses it at once, perfect for themes.

The `html, body { height: 100% }` rule makes the page fill the entire browser window. The `overflow: hidden` prevents the page from scrolling — the IDE panels handle their own scrolling internally instead.

---

## Key takeaways

- HTML gives a page its structure (`<html>`, `<body>`, headings, paragraphs, etc.).
- CSS controls appearance — colours, sizes, fonts, layout.
- JavaScript (and frameworks like React) control behaviour and interactivity.
- CSS variables let you define a colour palette once and reuse it everywhere.
- JSX is JavaScript that looks like HTML — Next.js compiles it into real HTML for the browser.

---

> **Next:** [Chapter 2 — React Components](02-react-components.md)
