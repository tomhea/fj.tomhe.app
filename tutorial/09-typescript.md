# Chapter 9 — TypeScript: Types & Interfaces

> **Previous:** [Chapter 8 — WebSockets](08-websockets.md) | **Next:** [Chapter 10 — Middleware & Security](10-middleware-security.md)

---

Every `.ts` and `.tsx` file you've seen in this tutorial is **TypeScript**, not plain JavaScript. TypeScript is JavaScript plus *types* — labels that say what shape a value has. The browser never runs TypeScript directly; it's checked and then compiled away to JavaScript. The payoff is that whole categories of bugs ("I passed a string where a number was expected", "I typo'd a property name") are caught while you type, not when a user clicks the button.

This IDE keeps its type definitions in one place: `lib/types.ts`. We'll read straight from it.

---

## Describing a shape with `interface`

An `interface` describes the shape of an object — which properties it has and what type each one is:

```ts
// lib/types.ts
export interface FJFile {
  id: string;
  name: string;
  content: string;
}
```

Now anywhere the code says `file: FJFile`, the compiler *knows* `file.name` is a string and that `file.colour` doesn't exist. A property can be optional — mark it with `?`:

```ts
// lib/types.ts
export interface SourceFile {
  name: string;
  type: 'bf' | 'c';
  content: string;
  fjOutput?: string;   // only present for C files, after conversion
}
```

`fjOutput?` means "this might be there, might not." TypeScript then forces you to check before using it, so you can't read a value that isn't set.

---

## Union types: a fixed set of values

Look at `type: 'bf' | 'c'` above. That's a **union of string literals**: `type` isn't just any string — it's *exactly* `'bf'` or `'c'`. The IDE uses this pattern for its status values:

```ts
// lib/types.ts
export type CompileStatus = 'idle' | 'compiling' | 'success' | 'error';
export type RunStatus = 'idle' | 'running' | 'exited' | 'error';
```

If you write `setCompileStatus('compilng')`, the typo is a compile error — the only allowed values are the four listed. This is the same `useState<T>` typing you met in Chapter 4: `useState<CompileStatus>('idle')` makes React state accept only those four strings.

---

## Typing component props

In Chapter 3 you passed *props* from parent to child. TypeScript lets a component declare exactly which props it accepts, and those status types flow straight in:

```ts
// a component receives typed props
compileStatus: CompileStatus;
runStatus: RunStatus;
onCompile: () => void;       // a callback that takes nothing, returns nothing
```

Now a parent that forgets `onCompile`, or passes `compileStatus="busy"`, gets a red squiggle immediately — the contract between parent and child is enforced.

---

## Discriminated unions: the WebSocket messages

Remember the WebSocket messages from Chapter 8 — every one was a JSON object with a `type` field? Those objects *are* TypeScript types. Each message shape is an interface, and they're combined into one union:

```ts
// lib/types.ts
export type ClientMessage = WsRunFj | WsCompileFj | WsRunFjm | WsStdin | WsKill;
export type ServerMessage = WsStdout | WsStderr | WsStarted | WsExit | WsError | WsFjmCompiled;
```

Because each variant has a distinct `type` string, when you `switch (msg.type)` (exactly what `ws.onmessage` did in Chapter 8) TypeScript *narrows* the type inside each `case`. In `case 'exit':` it knows `msg.code` exists; in `case 'stdout':` it knows `msg.data` is a string. The compiler tracks which shape you're holding.

---

## Where the types pay off

When the `/api/compile` route reads the request body, it states the shape it expects:

```ts
// app/api/compile/route.ts
const body = (await req.json()) as {
  files: Array<{ name: string; content: string }>;
};
```

From that line on, the compiler treats `body.files` as an array of `{ name, content }` objects — so the validation loop that follows is checked against a known shape. One annotation, and the rest of the function is type-safe.

---

## Key takeaways

- TypeScript is JavaScript with types; it's checked at build time and compiled away — the browser runs plain JavaScript.
- An `interface` describes an object's shape; a `?` marks an optional property.
- A union of string literals (`'idle' | 'compiling' | …`) restricts a value to a fixed set — typos become compile errors.
- Component props are typed too, so parent/child mismatches are caught immediately (Chapter 3) and `useState<T>` only accepts valid values (Chapter 4).
- A discriminated union (the WebSocket messages from Chapter 8) lets `switch` narrow to the exact shape, so each `case` knows which fields exist.

---

> **Next:** [Chapter 10 — Middleware & Security](10-middleware-security.md)
