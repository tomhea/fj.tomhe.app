# Chapter 4 — State: Making Things Interactive

> **Previous:** [Chapter 3 — Props](03-props.md) | **Next:** [Chapter 5 — Layout & Styling](05-layout-styling.md)

---

**State** is data that a component remembers between renders. When state changes, React automatically re-renders the component to show the new data.

You create state with the `useState` hook — a special React function. It returns two things: the current value, and a function to update it.

```ts
const [count, setCount] = useState(0);
//     ^^^^^  ^^^^^^^^^
//     value  updater function
```

Call `setCount(1)` and React re-renders the component with `count === 1`. That's the entire mechanism.

---

## All the state in this IDE

The IDE component is the single source of truth — it holds all the application state. Here are its `useState` calls:

```ts
// components/IDE.tsx — lines 113–134
const [files, setFiles] = useState<FJFile[]>(initial.files);
const [activeFileId, setActiveFileId] = useState<string>(initial.activeId);
const [sources, setSources] = useState<SourceFile[]>(
  () => loadFromLocalStorage<SourceFile[]>('fj-ide-sources') ?? [],
);
const [activeSourceIdx, setActiveSourceIdx] = useState<number | null>(null);
const [compiledFjm, setCompiledFjm] = useState<string | null>(null);
const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
const [compileStatus, setCompileStatus] = useState<CompileStatus>('idle');
const [runStatus, setRunStatus] = useState<RunStatus>('idle');
const [stdinContent, setStdinContent] = useState('');
const [markers, setMarkers] = useState<MonacoMarker[]>([]);
const [docsOpen, setDocsOpen] = useState(false);
const [sidebarCollapsed, setSidebarCollapsed] = useState(
  () => loadFromLocalStorage<boolean>('fj-ide-sidebar-collapsed') ?? false,
);
const [mobileTab, setMobileTab] = useState<'files' | 'editor' | 'terminal'>('editor');
```

Each piece of state has a clear job:

| Variable | What it holds |
|----------|--------------|
| `files` | The array of `.fj` files open in the editor |
| `activeFileId` | Which file is currently selected |
| `compiledFjm` | The compiled bytecode (null if not yet compiled) |
| `terminalLines` | Every line of output shown in the terminal |
| `compileStatus` | `'idle'` \| `'compiling'` \| `'success'` \| `'error'` |
| `mobileTab` | Which panel is shown on small screens |

The `<Type>` in `useState<FJFile[]>` is TypeScript telling React "this state will always be an array of `FJFile` objects".

---

## Updating state — the rules

State must **never be mutated directly**. Always use the setter function, and always create a new value rather than modifying the existing one.

```ts
// ❌ Wrong — mutating state directly
files[0].content = 'new content';

// ✅ Correct — create a new array with the change
setFiles(files.map((f) => (f.id === id ? { ...f, content: 'new content' } : f)));
```

Why? React detects changes by comparing old and new values. If you mutate the old value in place, React sees the same object and thinks nothing changed — so it won't re-render.

---

## Updating a file when you type

Here is how the IDE updates a file's content every time you type in the editor:

```ts
// components/IDE.tsx — updateFileContent
const updateFileContent = useCallback((id: string, content: string) => {
  setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, content } : f)));
  setCompiledFjm(null);   // typing invalidates the old compiled binary
  setMarkers([]);         // clear any error underlines
}, []);
```

`setFiles` receives a function `(prev) => ...` — this is the **updater form**. React passes the current state as `prev`, and you return the new state. Here, `prev.map(...)` creates a new array where the matching file gets the new content, and all other files are unchanged.

The `{ ...f, content }` syntax is the **spread operator** — it copies all properties of `f` into a new object, then overrides just `content`.

---

## Adding to state

Creating a new file appends it to the array:

```ts
// components/IDE.tsx — createFile
const createFile = useCallback((name: string) => {
  const f: FJFile = { id: uuidv4(), name, content: `// ${name}\n` };
  setFiles((prev) => [...prev, f]);   // spread old array + add new file at the end
  setActiveFileId(f.id);              // switch to the newly created file
  setActiveSourceIdx(null);
}, []);
```

`[...prev, f]` creates a brand-new array with all the old files plus the new one. The spread operator `...` expands an array in-place.

---

## Why `useCallback`?

You'll notice the state-updating functions are wrapped in `useCallback`. This is a performance optimization — it tells React "don't recreate this function on every render, only when its dependencies change". Without it, every render would produce a new function reference and cause child components to re-render unnecessarily.

---

## Key takeaways

- `useState(initialValue)` returns `[currentValue, setterFunction]`.
- Calling the setter causes React to re-render the component with the new value.
- **Never mutate state directly** — always call the setter with a completely new value.
- The updater form `setState(prev => newValue)` is safer when the new value depends on the old one.
- `{ ...obj, key: newValue }` creates a new object with one property changed (spread + override).
- `[...arr, newItem]` creates a new array with one item appended.

---

> **Next:** [Chapter 5 — Layout & Styling](05-layout-styling.md)
