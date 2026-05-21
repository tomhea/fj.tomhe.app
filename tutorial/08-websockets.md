# Chapter 8 — WebSockets: Real-Time

> **Previous:** [Chapter 7 — API Routes](07-api-routes.md) | **Next:** —

---

Regular HTTP (what `fetch()` uses) is **request-response**: the browser asks, the server answers, the connection closes. You can't use it for streaming — if a program is running and printing output continuously, you'd have to keep asking "is there new output?" every second. That's slow and wasteful.

**WebSockets** solve this. They open a persistent, two-way connection between the browser and server. Either side can send a message at any time — no waiting, no polling. The server pushes output to the browser *the moment it arrives*.

```
HTTP (request-response):
  Browser ──── "give me the data" ────► Server
  Browser ◄─── "here is the data" ──── Server
  [connection closes]

WebSocket (persistent):
  Browser ◄──────────────────────────► Server
  [connection stays open]
  Server ──── "stdout chunk 1" ───────► Browser
  Server ──── "stdout chunk 2" ───────► Browser
  Server ──── "process exited" ───────► Browser
```

---

## Opening the connection and sending the program

When you click "Run", the IDE opens a WebSocket to `/ws/run` and sends the files:

```ts
// components/IDE.tsx — opening the WebSocket
const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProto}//${window.location.host}/ws/run`);

ws.onopen = () => {
  // Connection is open — send the program files to the server
  ws.send(
    JSON.stringify({
      type: 'run_fj',
      files: files.map((f) => ({ name: f.name, content: f.content })),
      initialStdin: stdinContent || undefined,
    }),
  );
};
```

- `new WebSocket(url)` opens the connection (uses `wss:` for secure connections, same as `https:` vs `http:`).
- `ws.onopen` is a callback that fires when the connection is established and ready.
- `ws.send()` sends a JSON string to the server.

---

## Receiving streaming output

The server sends a message for every chunk of output. The browser receives them in `ws.onmessage`:

```ts
// components/IDE.tsx — ws.onmessage
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'stdout':
      streamChunk('stdout', msg.data);   // append to terminal in gray
      break;
    case 'stderr':
      streamChunk('stderr', msg.data);   // append to terminal in orange
      break;
    case 'exit':
      const elapsed = ((Date.now() - runStartRef.current) / 1000).toFixed(2);
      addLine('info', `✓ Process exited (code ${msg.code}) — ${elapsed}s`);
      setRunStatus('exited');
      break;
    case 'error':
      addLine('error', msg.data);
      setRunStatus('error');
      break;
  }
};
```

Each message is a JSON object with a `type` field. The browser switches on the type and updates the terminal accordingly.

---

## The server side: piping program output

On the server (`server.ts`), the FlipJump binary is started as a child process. Its stdout and stderr are piped directly into the WebSocket:

```ts
// server.ts — streaming child process output to the browser
child.stdout?.on('data', (chunk: Buffer) => {
  const text = outDec.write(chunk);           // decode UTF-8 bytes
  if (text) send({ type: 'stdout', data: text });   // push to browser instantly
});

child.stderr?.on('data', (chunk: Buffer) => {
  const text = errDec.write(chunk);
  if (text) send({ type: 'stderr', data: text });
});

child.on('close', (code, signal) => {
  send({ type: 'exit', code, signal });       // tell browser the process ended
});
```

`child.stdout?.on('data', ...)` fires every time the running program writes anything to stdout — even a single character. The server immediately forwards that chunk to the browser via the WebSocket. This is why output appears in the terminal as the program runs, not all at once at the end.

---

## The full chain

Putting it all together:

```
FlipJump program (running on server)
  ↓ writes to stdout
Node.js child process event: 'data'
  ↓ server.ts sends WebSocket message: { type: 'stdout', data: '...' }
WebSocket connection
  ↓ ws.onmessage fires in the browser
React state update: setTerminalLines(...)
  ↓ React re-renders Terminal component
New line appears in the terminal on your screen
```

Every step happens within milliseconds of the program printing a character.

---

## Sending stdin (user input)

The connection is two-way, so the user can also send input to the running program:

```ts
// components/IDE.tsx — sending user input
function sendStdin(input: string) {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify({ type: 'stdin', stdin: input }));
  }
}
```

The server receives this message, writes the text to the child process's stdin, and the program continues.

---

## Key takeaways

- HTTP is request-response (one question, one answer, connection closes). WebSockets are persistent two-way channels.
- `new WebSocket(url)` opens a connection; `ws.send()` sends a message; `ws.onmessage` handles incoming messages.
- Messages are JSON strings — both sides use `JSON.stringify()` to send and `JSON.parse()` to receive.
- The server pipes child process stdout/stderr into the WebSocket in real time — that's what makes output appear as it runs.
- WebSockets are two-way: the browser can also send stdin to the running program.

---

## What's next?

You've now seen all the major layers of this web app:

| Layer | Technology | Chapter |
|-------|-----------|---------|
| HTML structure | JSX / Next.js layouts | 1–2 |
| Component composition | React props | 3 |
| Interactivity | React state | 4 |
| Visual design | Tailwind CSS + CSS variables | 5 |
| Browser integrations | `useEffect` | 6 |
| Server logic | Next.js API routes | 7 |
| Real-time communication | WebSockets | 8 |

A good next step is to pick one file — say `components/Terminal.tsx` or `components/FileTree.tsx` — open it alongside this tutorial, and try to read through it yourself. You now have the vocabulary to understand most of what you'll find.

---

> **Back to index:** [tutorial/README.md](README.md)
