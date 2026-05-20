# Chapter 7 — API Routes: The Backend

> **Previous:** [Chapter 6 — Effects](06-effects.md) | **Next:** [Chapter 8 — WebSockets](08-websockets.md)

---

Web apps often need a **backend** — code that runs on the server, not in the browser. The browser can't run arbitrary system commands, read files from disk, or safely store secrets. A server can.

Next.js has a built-in way to write backend code alongside your frontend: **API routes**. Any file inside `app/api/` that exports an HTTP method function (`GET`, `POST`, etc.) becomes an endpoint your browser can call with `fetch()`.

---

## The compile API route

When you click "Compile", the browser sends your code to `/api/compile`. The server runs the real `fj` compiler binary and returns the compiled bytecode. Here is how the browser makes that request:

```ts
// components/IDE.tsx — the fetch() call inside doCompile()
const res = await fetch('/api/compile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    files: files.map((f) => ({ name: f.name, content: f.content })),
  }),
});

const data = await res.json();
// data = { success: true, fjmBase64: "...", stderr: "" }

if (data.success && data.fjmBase64) {
  setCompiledFjm(data.fjmBase64);
  setCompileStatus('success');
} else {
  setCompileStatus('error');
}
```

- `fetch()` is the browser's built-in function for making HTTP requests. It returns a **Promise** — a value that will be resolved in the future once the server responds.
- `await` pauses execution until the response arrives. Without it, you'd get a Promise object instead of the actual data.
- The request sends files as JSON in the body. The response comes back as JSON too.

---

## The server-side handler

Here is the API route that handles that request — `app/api/compile/route.ts`:

```ts
export async function POST(req: NextRequest) {
  // 1. Parse the incoming JSON body
  const body = await req.json();
  //   body.files = [{ name: 'hello.fj', content: '...' }, ...]

  // 2. Write each file to a temporary directory on the server
  const tempDir = join(tmpdir(), `fj-compile-${uuidv4()}`);
  await mkdir(tempDir, { recursive: true });
  for (const file of body.files) {
    await writeFile(join(tempDir, file.name), file.content, 'utf8');
  }

  // 3. Run the fj compiler binary
  const outPath = join(tempDir, 'program.fjm');
  await execFileAsync(FJ_CMD, ['--asm', '-o', outPath, ...paths]);

  // 4. Read the compiled output and encode it as base64
  const fjmBuffer = await readFile(outPath);
  const fjmBase64 = fjmBuffer.toString('base64');

  // 5. Send the result back to the browser
  return NextResponse.json({ success: true, fjmBase64, stderr });
}
```

The API route is just an `async` function named `POST` (matching the HTTP method). It receives a `Request` object and returns a `Response`. Everything in between is ordinary Node.js — file system access, running shell commands, reading output.

**The browser never runs this code.** It only sees the final JSON response. This is what makes APIs powerful: the server can do anything, the browser just gets the result.

---

## The request-response lifecycle

```
Browser                          Server (Next.js)
──────                           ────────────────
fetch('/api/compile', {          POST /api/compile
  method: 'POST',           →    body = req.json()
  body: JSON.stringify(files)    ... run fj compiler ...
})                          ←    return NextResponse.json(result)
const data = await res.json()
setCompiledFjm(data.fjmBase64)
```

1. Browser sends a POST request with the files as JSON.
2. Server parses the body, runs the compiler, reads the output.
3. Server returns JSON with the compiled binary (base64-encoded).
4. Browser receives the JSON, updates state, re-renders.

---

## Why base64?

Binary files (like a compiled `.fjm` file) can't be directly embedded in JSON, which is plain text. **Base64** is an encoding that converts arbitrary bytes into a string of printable characters, safe to put in JSON. The browser decodes it back to bytes when needed.

---

## Key takeaways

- Next.js API routes live in `app/api/` and become HTTP endpoints — no separate server needed.
- Export a function named `GET`, `POST`, etc. to handle that HTTP method.
- The browser calls them with `fetch(url, { method: 'POST', body: JSON.stringify(data) })`.
- `await fetch(...)` waits for the network response before continuing.
- The server-side handler can run binaries, read files, access databases — the browser only sees the JSON response.

---

> **Next:** [Chapter 8 — WebSockets: Real-Time](08-websockets.md)
