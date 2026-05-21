# Chapter 5 — Layout & Styling

> **Previous:** [Chapter 4 — State](04-state.md) | **Next:** [Chapter 6 — Effects](06-effects.md)

---

CSS layout used to mean writing a lot of custom rules. **Tailwind CSS** is a library that gives you pre-built utility classes — short class names you apply directly in HTML/JSX that each map to a single CSS rule.

```tsx
// Without Tailwind — you'd write separate CSS
<div className="my-container">...</div>

/* In a CSS file somewhere */
.my-container { display: flex; flex-direction: column; padding: 16px; }

// With Tailwind — everything in one place
<div className="flex flex-col p-4">...</div>
```

---

## The IDE layout in full

Here is the top-level JSX that creates the three-column IDE layout:

```tsx
// components/IDE.tsx — the return statement
return (
  <div
    className="ide-root flex flex-col"
    style={{ background: '#1e1e1e', overflow: 'hidden' }}
  >
    <header>
      <Toolbar ... />
    </header>

    <main className="flex flex-1 min-h-0">

      {/* File tree — left sidebar on desktop, full panel on mobile */}
      <div className={
        mobileTab === 'files'
          ? 'flex flex-col flex-1 min-h-0 md:flex md:flex-none md:flex-col'
          : 'hidden md:flex md:flex-none md:flex-col'
      }>
        <FileTree ... />
      </div>

      {/* Editor + Terminal column — fills the rest */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <CodeEditor ... />
        <Terminal ... />
      </div>

    </main>
  </div>
);
```

Reading the Tailwind classes:

| Class | What it does |
|-------|-------------|
| `flex` | `display: flex` — children arranged in a row (or column with `flex-col`) |
| `flex-col` | `flex-direction: column` — stack children vertically |
| `flex-1` | `flex: 1` — take all remaining space in the parent |
| `min-h-0` | `min-height: 0` — lets flex children shrink below their natural height |
| `hidden` | `display: none` — completely invisible |

---

## Responsive design with `md:`

Tailwind's `md:` prefix applies a class **only when the screen is at least 768px wide**. On a phone (smaller screen), the prefix is ignored.

```tsx
className="hidden md:flex md:flex-none md:flex-col"
```

This means:
- **Mobile (< 768px):** `hidden` → file tree is invisible
- **Desktop (≥ 768px):** `md:flex md:flex-none md:flex-col` → file tree is a fixed-width sidebar

On mobile, the file tree is shown instead as a full-screen tab, controlled by the `mobileTab` state variable. When you tap "Files" at the bottom of the screen, `mobileTab` becomes `'files'` and the conditional class switches from `hidden` to `flex`:

```tsx
className={
  mobileTab === 'files'
    ? 'flex flex-col flex-1 min-h-0'  // show full-screen
    : 'hidden md:flex md:flex-none'   // hide on mobile, show on desktop
}
```

This is a common pattern: **Tailwind handles static breakpoints, React state handles dynamic switching**.

---

## Tailwind vs inline styles

The IDE uses both. The rule of thumb:

- **Tailwind** for layout, spacing, display, and responsive breakpoints.
- **Inline `style={{}}`** for specific colour values that come from the CSS variable palette.

For example:
```tsx
<div
  className="flex flex-1 min-h-0"         // layout via Tailwind
  style={{ background: '#252526' }}        // colour via inline style
>
```

---

## The `.ide-root` class

One custom class is defined in `app/globals.css`:

```css
.ide-root {
  height: 100vh;
  height: 100dvh;  /* shrinks/grows as mobile browser chrome animates */
  padding-bottom: env(safe-area-inset-bottom);
  padding-left:   env(safe-area-inset-left);
  padding-right:  env(safe-area-inset-right);
}
```

`100dvh` ("dynamic viewport height") is a modern CSS unit that adjusts as the mobile browser's address bar shows or hides. The `env(safe-area-inset-*)` values add padding so content isn't hidden behind the iPhone notch or home indicator.

---

## Key takeaways

- Tailwind CSS provides utility classes — short names that each apply one CSS rule.
- `flex flex-col` creates a vertical flex container; `flex-1` makes a child fill remaining space.
- `md:` prefix applies a class only on screens ≥ 768px wide (Tailwind's "medium" breakpoint).
- Tailwind handles static breakpoints; React `state` handles dynamic view switching.
- Inline `style={{}}` is used for specific colour values; Tailwind is used for layout.

---

> **Next:** [Chapter 6 — Effects: Talking to the World](06-effects.md)
