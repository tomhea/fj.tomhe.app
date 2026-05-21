# Chapter 3 — Props: Passing Data

> **Previous:** [Chapter 2 — React Components](02-react-components.md) | **Next:** [Chapter 4 — State](04-state.md)

---

**Props** (short for "properties") are how a parent component passes data to a child component. They work just like function arguments — because components *are* functions.

When you write `<Button color="red" label="Click me" />`, you are calling the `Button` function and passing it two props: `color` and `label`.

```tsx
// The child defines what props it accepts
function Button({ color, label }: { color: string; label: string }) {
  return <button style={{ background: color }}>{label}</button>;
}

// The parent passes values in
function App() {
  return <Button color="red" label="Click me" />;
}
```

---

## The Toolbar's props

The `Toolbar` component needs a lot of information from the IDE: the current compile status, whether something is running, what to do when buttons are clicked, and more. All of this is described as a TypeScript **interface** — a named type that says exactly what shape the props must have:

```ts
// components/Toolbar.tsx — lines 8–27
interface ToolbarProps {
  compileStatus: CompileStatus;
  runStatus: RunStatus;
  compiledFjm: string | null;
  onCompile: () => void;
  onDownloadFjm: () => void;
  onRunFj: () => void;
  onRunFjm: () => void;
  onKill: () => void;
  onImportBf: (content: string, filename: string) => void;
  onImportC: (formData: FormData) => void;
  onImportFj: (files: Array<{ name: string; content: string }>) => void;
  onImportFjm: (base64: string) => void;
  onLoadExample: (ex: Example) => void;
  onCopyLink: () => void;
  onOpenDocs: () => void;
  c2fjOutput: string | null;
  onRunC2fjSource: () => void;
}
```

Notice the props named `onCompile`, `onRunFj`, etc. — these are **callback props**. Instead of passing a value, the parent passes a *function* to the child. When the user clicks "Compile" in the toolbar, the toolbar calls `onCompile()`, which runs the actual compile logic up in the IDE parent.

This pattern — *data flows down, events bubble up* — is the core of React's data model.

---

## Passing props from the IDE

Here is where the IDE parent renders the Toolbar and fills in all those props:

```tsx
// components/IDE.tsx — the <Toolbar /> call
<Toolbar
  compileStatus={compileStatus}
  runStatus={runStatus}
  compiledFjm={compiledFjm}
  onCompile={compile}
  onDownloadFjm={downloadFjm}
  onRunFj={() => runOnline('fj')}
  onRunFjm={() => runOnline('fjm')}
  onKill={killProcess}
  onImportBf={importBf}
  onImportC={importC}
  onImportFj={importFjFiles}
  onImportFjm={importFjm}
  onLoadExample={loadExample}
  onCopyLink={copyLink}
  onOpenDocs={() => setDocsOpen(true)}
  c2fjOutput={c2fjOutput}
  onRunC2fjSource={runC2fjSource}
/>
```

The curly braces `{}` in JSX are escape hatches into JavaScript. `compileStatus={compileStatus}` means "pass the value of the JavaScript variable `compileStatus` as this prop". `onCompile={compile}` passes the `compile` function itself as a prop.

---

## TypeScript interfaces catch mistakes

Without TypeScript, you could pass the wrong type and only find out when the app crashes. With the interface, the editor tells you immediately:

```tsx
<Toolbar
  compileStatus={42}  // ❌ TypeScript error: number is not CompileStatus
  onCompile="hello"   // ❌ TypeScript error: string is not a function
  ...
/>
```

This is one of the main reasons real-world projects use TypeScript.

---

## Key takeaways

- Props are the "arguments" you pass to a component when you use it.
- TypeScript interfaces describe exactly what props a component expects and what types they must be.
- Callback props (functions like `onCompile`) let child components trigger actions in their parents.
- Curly braces `{}` inside JSX let you embed any JavaScript expression as a prop value.
- Data flows *down* (parent → child via props); events flow *up* (child → parent via callbacks).

---

> **Next:** [Chapter 4 — State: Making Things Interactive](04-state.md)
