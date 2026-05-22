# Chapter 6 — Effects: Talking to the World

> **Previous:** [Chapter 5 — Layout & Styling](05-layout-styling.md) | **Next:** [Chapter 7 — API Routes](07-api-routes.md)

---

React components are *pure* by design — given the same props and state, they always return the same JSX. But real apps need to do things with **side effects**: save data to disk, listen to browser events, start timers, make network requests.

`useEffect` is where React lets you run code with side effects. It runs *after* React renders the component to the screen.

```ts
useEffect(() => {
  // this runs after render
}, [dependency1, dependency2]);
//  ↑ the dependency array: re-run only when these values change
```

---

## Responding to screen size changes

The IDE watches the viewport width to know if it's running on a phone. This needs a browser API (`window.matchMedia`) that can only be called in an effect:

```ts
// components/IDE.tsx — media query effect
useEffect(() => {
  const mq = window.matchMedia('(max-width: 767px)');
  const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);  // cleanup!
}, []);
```

- The empty `[]` dependency array means "run once, when the component first mounts (appears on screen)".
- The function returned at the end is a **cleanup function** — React calls it when the component unmounts (is removed from the page), preventing orphaned event listeners.

---

## Saving to localStorage

These three effects persist state to the browser's local storage so your files survive a page refresh:

```ts
// components/IDE.tsx — persist effects
useEffect(() => {
  saveToLocalStorage('fj-ide-files', files);
}, [files]);   // re-run whenever 'files' changes

useEffect(() => {
  saveToLocalStorage('fj-ide-sources', sources);
}, [sources]);

useEffect(() => {
  saveToLocalStorage('fj-ide-sidebar-collapsed', sidebarCollapsed);
}, [sidebarCollapsed]);
```

Each effect has a single item in its dependency array. Whenever `files` changes (you add a file, rename one, type in the editor), the first effect re-runs and saves the updated state. `localStorage` is a simple key-value store built into every browser — data stored there persists until you clear it.

---

## Debouncing — the cancel-and-restart pattern

Saving on *every* keystroke can be wasteful: imagine kicking off an expensive operation (like compressing a large project before persisting it) inside the `[files]` effect above. The solution is **debouncing** — wait until the user has stopped typing for some interval, then run the work exactly once:

```ts
// generic debounce effect
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  if (timerRef.current) clearTimeout(timerRef.current);

  timerRef.current = setTimeout(() => {
    expensiveSave(files);
  }, 1000);  // wait 1 second after the last change

  return () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };
}, [files]);
```

Every time `files` changes, the effect:
1. Cancels the previous pending timer (if any).
2. Starts a fresh 1-second countdown.
3. Returns a cleanup that cancels the timer when the component unmounts.

If you keep typing, the timer resets each time. Only when you pause for a full second does it run.

The IDE itself uses the plain (non-debounced) form for `fj-ide-files` because writing to `localStorage` is cheap. Debouncing becomes essential the moment the side-effect grows costly (network calls, large serializations, etc.).

---

## `useRef` — a ref doesn't trigger re-renders

Notice `timerRef.current` in the example above. `useRef` creates a box that holds a mutable value. Unlike `useState`, changing a ref does **not** trigger a re-render — it just stores a value for the next time the component runs.

Refs are used for:
- Timer handles (so you can cancel them later)
- WebSocket instances
- DOM element references
- Any mutable value that doesn't need to be displayed

---

## Key takeaways

- `useEffect(() => { ... }, [deps])` runs code after React renders.
- The dependency array controls *when* the effect re-runs: `[]` = once on mount, `[x]` = whenever `x` changes.
- The return value is a cleanup function — called when the component unmounts or before the effect re-runs.
- Debouncing (cancel + restart a timer on each change) prevents expensive work from running too often.
- `useRef` stores mutable values (like timer IDs) that don't need to trigger re-renders.

---

> **Next:** [Chapter 7 — API Routes: The Backend](07-api-routes.md)
