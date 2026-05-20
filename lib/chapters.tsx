import React from 'react';

export interface CodeSnippet {
  file: string;
  code: string;
}

export interface Chapter {
  id: string;
  title: string;
  subtitle: string;
  blocks: Array<
    | { kind: 'prose'; content: React.ReactNode }
    | { kind: 'code'; snippet: CodeSnippet }
  >;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'html-css-js',
    title: 'The Web: HTML, CSS & JavaScript',
    subtitle: 'What the browser actually does',
    blocks: [
      {
        kind: 'prose',
        content: (
          <>
            <p>Every website you have ever visited is made of three things working together:</p>
            <ul>
              <li><strong style={{ color: '#f48771' }}>HTML</strong> — the <em>structure</em>. It describes what is on the page: headings, paragraphs, buttons, images.</li>
              <li><strong style={{ color: '#569cd6' }}>CSS</strong> — the <em>appearance</em>. It controls colors, sizes, layout, fonts, and animations.</li>
              <li><strong style={{ color: '#4ec9b0' }}>JavaScript</strong> — the <em>behaviour</em>. It makes things interactive: clicking a button, loading data, updating the screen without a full page reload.</li>
            </ul>
            <p>When you visit a website, your browser downloads these three files and assembles them into what you see.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>The HTML shell of this IDE</h2>
            <p>Every Next.js app has a <em>root layout</em> — a file that produces the outermost HTML structure. Here is ours, in <code>app/layout.tsx</code>:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'app/layout.tsx',
          code: `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ height: '100%', margin: 0 }}>{children}</body>
    </html>
  );
}`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p>This looks like HTML, but it is actually <strong>JSX</strong> — a JavaScript syntax that lets you write HTML-like tags inside JavaScript code. The browser never sees JSX directly; Next.js translates it into real HTML before sending it.</p>
            <p>Notice <code>{'{children}'}</code>. That is a <em>slot</em> — every page of the app is inserted here. Think of it as a picture frame: the frame (layout) stays constant, the picture (page content) swaps out.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>CSS: making things look right</h2>
            <p>This IDE has a dark "VS Code" theme. All the colours are defined as <strong>CSS variables</strong> in <code>app/globals.css</code>:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'app/globals.css',
          code: `:root {
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
}`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p>CSS variables (written as <code>--name: value</code>) are like constants in a programming language. Once you define <code>--ide-bg: #1e1e1e</code>, you can use <code>var(--ide-bg)</code> anywhere in your CSS and changing the variable updates every element that uses it — perfect for themes.</p>
            <p>The <code>html, body {'{'} height: 100% {'}'}</code> rule makes the page fill the entire browser window. The <code>overflow: hidden</code> prevents the page from ever scrolling — the IDE panels handle scrolling internally instead.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Key takeaways</h2>
            <ul>
              <li>HTML gives a page its structure (<code>&lt;html&gt;</code>, <code>&lt;body&gt;</code>, etc.).</li>
              <li>CSS controls appearance — colours, sizes, layout.</li>
              <li>JavaScript (and frameworks like React) control behaviour and interactivity.</li>
              <li>CSS variables let you define a colour palette once and reuse it everywhere.</li>
            </ul>
          </>
        ),
      },
    ],
  },

  {
    id: 'react-components',
    title: 'React Components',
    subtitle: 'Functions that return HTML',
    blocks: [
      {
        kind: 'prose',
        content: (
          <>
            <p>React is a JavaScript library for building user interfaces. Its central idea is the <strong>component</strong>: a JavaScript function that returns a piece of HTML (written as JSX).</p>
            <p>You build a page by composing many components together, like LEGO bricks. Each component is responsible for one part of the UI.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>The simplest real component in this project</h2>
            <p>Here is the entire <code>app/page.tsx</code> file — the "home page" of this site:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'app/page.tsx',
          code: `'use client';

import dynamic from 'next/dynamic';

// The IDE reads localStorage and URL params at mount, so there is no
// sensible server-rendered first paint. Disabling SSR for this client
// component eliminates the hydration mismatch.
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
}`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p>Let&apos;s break this down line by line:</p>
            <ul>
              <li><code>&apos;use client&apos;</code> — Next.js can run components on the <em>server</em> (to generate HTML faster) or in the <em>browser</em>. This directive tells Next.js: "this component must run in the browser." The IDE needs the browser because it uses <code>localStorage</code> and the <code>window</code> object, which don&apos;t exist on a server.</li>
              <li><code>dynamic(..., {'{'} ssr: false {'}'})</code> — This is a "lazy load". Instead of including the IDE in the initial page download, the browser fetches it separately after the page loads. The <code>loading</code> prop defines what to show while it&apos;s downloading — the "Loading FlipJump IDE…" screen you see on first visit.</li>
              <li><code>export default function Home()</code> — This is the component itself. It is just a JavaScript function. The <code>export default</code> makes it the "main export" of the file, which Next.js uses as the page.</li>
              <li><code>return &lt;IDE /&gt;</code> — The function returns JSX. <code>&lt;IDE /&gt;</code> is how you use a component — it looks like an HTML tag but starts with a capital letter (React&apos;s way of distinguishing components from real HTML elements).</li>
            </ul>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>The component tree</h2>
            <p>This project has 7 main components that fit together like this:</p>
            <pre style={{ background: '#252526', padding: '16px', borderRadius: 4, color: '#d4d4d4', fontSize: 13, lineHeight: 1.7, overflowX: 'auto' }}>{`Home (app/page.tsx)
└── IDE (components/IDE.tsx)          ← orchestrates everything
    ├── Toolbar                        ← top button bar
    ├── FileTree                       ← left sidebar
    ├── CodeEditor                     ← the editor itself (Monaco)
    ├── Terminal                       ← bottom output panel
    └── DocsPanel                      ← right-side docs drawer`}</pre>
            <p>Each component is a separate file in the <code>components/</code> folder. The <code>IDE</code> component is the "parent" that owns all the data and passes it down to the others.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Key takeaways</h2>
            <ul>
              <li>A React component is just a function that returns JSX (HTML-like syntax).</li>
              <li>Component names start with a capital letter. HTML tag names don&apos;t.</li>
              <li><code>&apos;use client&apos;</code> makes a component run in the browser, not on the server.</li>
              <li><code>dynamic(...)</code> lazy-loads a component so the page can appear before the heavy code downloads.</li>
              <li>Components compose into a tree — parents render children.</li>
            </ul>
          </>
        ),
      },
    ],
  },

  {
    id: 'props',
    title: 'Props: Passing Data',
    subtitle: 'How parents talk to children',
    blocks: [
      {
        kind: 'prose',
        content: (
          <>
            <p><strong>Props</strong> (short for "properties") are how a parent component passes data to a child component. They work just like function arguments — because components <em>are</em> functions.</p>
            <p>When you write <code>&lt;Button color="red" label="Click me" /&gt;</code>, you are calling the <code>Button</code> function and passing it two props: <code>color</code> and <code>label</code>.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>The Toolbar&apos;s props</h2>
            <p>The <code>Toolbar</code> component needs a lot of information from the IDE: the current compile status, whether something is running, what to do when buttons are clicked, and more. All of this is defined as a TypeScript <strong>interface</strong> — a description of what shape the props must have:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'components/Toolbar.tsx — lines 8–27',
          code: `interface ToolbarProps {
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
}`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p>Notice the props named <code>onCompile</code>, <code>onRunFj</code>, etc. — these are <strong>callback props</strong>. Instead of passing a value, the parent passes a <em>function</em> to the child. When the user clicks "Compile" in the toolbar, the toolbar calls <code>onCompile()</code>, which runs the actual compile logic up in the IDE parent.</p>
            <p>This pattern — <em>data flows down, events bubble up</em> — is the core of React&apos;s data model.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Passing props from the IDE</h2>
            <p>Here is where the IDE parent actually renders the Toolbar and fills in all those props:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'components/IDE.tsx — the <Toolbar /> call',
          code: `<Toolbar
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
/>`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p>The curly braces <code>{'{}'}</code> in JSX are escape hatches into JavaScript. <code>compileStatus={'{compileStatus}'}</code> means "pass the value of the JavaScript variable <code>compileStatus</code> as this prop". <code>onCompile={'{compile}'}</code> passes the <code>compile</code> function itself as a prop.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Key takeaways</h2>
            <ul>
              <li>Props are the "arguments" you pass to a component when you use it.</li>
              <li>TypeScript interfaces describe exactly what props a component expects and what types they must be.</li>
              <li>Callback props (functions like <code>onCompile</code>) let child components trigger actions in their parents.</li>
              <li>Curly braces <code>{'{}'}</code> inside JSX let you embed any JavaScript expression.</li>
            </ul>
          </>
        ),
      },
    ],
  },

  {
    id: 'state',
    title: 'State: Making Things Interactive',
    subtitle: 'Memory that lives inside a component',
    blocks: [
      {
        kind: 'prose',
        content: (
          <>
            <p><strong>State</strong> is data that a component remembers between renders. When state changes, React automatically re-renders the component to show the new data.</p>
            <p>You create state with the <code>useState</code> hook — a special React function. It returns two things: the current value, and a function to update it.</p>
            <pre style={{ background: '#252526', padding: '12px', borderRadius: 4, color: '#d4d4d4', fontSize: 13 }}>{`const [count, setCount] = useState(0);
//     ^^^^^  ^^^^^^^^^
//     value  updater function`}</pre>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>All the state in this IDE</h2>
            <p>The IDE component is the single source of truth — it holds all the application state. Here are its <code>useState</code> calls:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'components/IDE.tsx — lines 113–134',
          code: `const [files, setFiles] = useState<FJFile[]>(initial.files);
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
const [mobileTab, setMobileTab] = useState<'files' | 'editor' | 'terminal'>('editor');`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p>Each piece of state has a clear job:</p>
            <ul>
              <li><code>files</code> — the array of <code>.fj</code> files open in the editor</li>
              <li><code>activeFileId</code> — which file is currently selected</li>
              <li><code>compiledFjm</code> — the compiled bytecode (null if not yet compiled)</li>
              <li><code>terminalLines</code> — every line of output shown in the terminal</li>
              <li><code>compileStatus</code> — &apos;idle&apos; | &apos;compiling&apos; | &apos;success&apos; | &apos;error&apos;</li>
              <li><code>mobileTab</code> — which panel is shown on small screens</li>
            </ul>
            <p>The <code>{'<Type>'}</code> in <code>useState{'<FJFile[]>'}</code> is TypeScript telling React "this state will always be an array of <code>FJFile</code> objects".</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Updating state</h2>
            <p>State must never be mutated directly — always use the setter function. Here is how the IDE updates a file&apos;s content when you type in the editor:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'components/IDE.tsx — updateFileContent',
          code: `const updateFileContent = useCallback((id: string, content: string) => {
  setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, content } : f)));
  setCompiledFjm(null);   // typing invalidates the old compiled binary
  setMarkers([]);         // clear any error underlines
}, []);`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p><code>setFiles</code> receives a function <code>(prev) =&gt; ...</code> — this is the <em>updater form</em>. React passes the current state as <code>prev</code>, and you return the new state. Here, <code>prev.map(...)</code> creates a new array where the matching file gets the new content, and all other files are unchanged.</p>
            <p>The rule is: <strong>never mutate, always replace</strong>. <code>prev[0].content = newContent</code> would be wrong — instead, create a new array with <code>map</code>.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Adding to state</h2>
            <p>Creating a new file appends it to the array:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'components/IDE.tsx — createFile',
          code: `const createFile = useCallback((name: string) => {
  const f: FJFile = { id: uuidv4(), name, content: \`// \${name}\\n\` };
  setFiles((prev) => [...prev, f]);   // spread old array + add new file
  setActiveFileId(f.id);              // switch to the newly created file
  setActiveSourceIdx(null);
}, []);`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p><code>[...prev, f]</code> creates a brand-new array containing all the old files plus the new one. The spread operator <code>...</code> expands an array in-place.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Key takeaways</h2>
            <ul>
              <li><code>useState(initialValue)</code> returns <code>[currentValue, setterFunction]</code>.</li>
              <li>Calling the setter causes React to re-render the component with the new value.</li>
              <li>Never mutate state directly — always call the setter with a new value.</li>
              <li>The updater form <code>setState(prev =&gt; newValue)</code> is safer when the new value depends on the old one.</li>
            </ul>
          </>
        ),
      },
    ],
  },

  {
    id: 'layout-styling',
    title: 'Layout & Styling',
    subtitle: 'Flexbox, Tailwind, and responsive design',
    blocks: [
      {
        kind: 'prose',
        content: (
          <>
            <p>CSS layout used to require writing a lot of custom rules. <strong>Tailwind CSS</strong> is a library that gives you pre-built utility classes — short class names you apply directly in your HTML/JSX that each apply a single CSS rule.</p>
            <p>For example, <code>className="flex flex-col items-center p-4 bg-gray-900"</code> applies five CSS rules at once: display flex, flex-direction column, align-items center, padding 1rem, background dark gray.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>The IDE layout</h2>
            <p>Here is the top-level JSX that creates the IDE&apos;s layout:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'components/IDE.tsx — the return statement',
          code: `return (
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

      {/* Editor + Terminal column */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <CodeEditor ... />
        <Terminal ... />
      </div>

    </main>
  </div>
);`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p>Let&apos;s read the Tailwind classes:</p>
            <ul>
              <li><code>flex flex-col</code> — Flexbox with children stacked vertically. The header goes above main.</li>
              <li><code>flex-1</code> — "take all remaining space". Main stretches to fill the window height after the header.</li>
              <li><code>min-h-0</code> — a flexbox quirk fix. Without it, children refuse to shrink below their natural height.</li>
              <li><code>hidden md:flex</code> — hidden by default, but on screens ≥768px wide (<code>md:</code>), switch to flex. This is how the file tree disappears on mobile.</li>
            </ul>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Responsive design</h2>
            <p>Tailwind&apos;s <code>md:</code> prefix applies a class only when the screen is at least 768px wide. On a phone (small screen), the file tree is <code>hidden</code>. On a desktop (<code>md</code>+), it shows as a sidebar.</p>
            <p>But the IDE also needs to know which panel is active on mobile to show the right content. That&apos;s handled by the <code>mobileTab</code> state variable — when you tap "Files" at the bottom, <code>mobileTab</code> becomes <code>&apos;files&apos;</code>, and the conditional class name switches from <code>hidden</code> to <code>flex</code>.</p>
            <p>This is a common pattern: <strong>Tailwind handles static breakpoints, React state handles dynamic switching</strong>.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Inline styles vs Tailwind</h2>
            <p>The IDE uses both. The rule of thumb in this project:</p>
            <ul>
              <li><strong>Tailwind</strong> for layout (flex, grid, padding, sizing, display) and responsive breakpoints.</li>
              <li><strong>Inline <code>style={'{{}}'}</code></strong> for specific colour values and pixel sizes that reference the CSS variables.</li>
            </ul>
            <p>For example: <code>className="flex flex-1"</code> (Tailwind layout) plus <code>style={'{{'} background: &apos;#1e1e1e&apos; {'}}'}  </code>(inline theme colour).</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Key takeaways</h2>
            <ul>
              <li>Tailwind CSS gives you utility classes like <code>flex</code>, <code>p-4</code>, <code>hidden</code> that apply a single CSS rule each.</li>
              <li><code>md:</code> prefix applies a class only on screens ≥768px wide.</li>
              <li>Flexbox (<code>flex</code>) arranges children in a row or column and lets them grow/shrink to fill space.</li>
              <li>Tailwind handles layout; React state handles dynamic switching between views.</li>
            </ul>
          </>
        ),
      },
    ],
  },

  {
    id: 'effects',
    title: 'Effects: Talking to the World',
    subtitle: 'useEffect for side effects',
    blocks: [
      {
        kind: 'prose',
        content: (
          <>
            <p>React components are <em>pure</em> by design — given the same props and state, they always return the same JSX. But real apps need to do things with side effects: save to disk, listen to events, start timers, make network requests.</p>
            <p><code>useEffect</code> is where React lets you run code with side effects. It runs <em>after</em> React renders the component.</p>
            <pre style={{ background: '#252526', padding: '12px', borderRadius: 4, color: '#d4d4d4', fontSize: 13 }}>{`useEffect(() => {
  // runs after render
}, [dependency1, dependency2]);
// ↑ the dependency array: re-run whenever these values change`}</pre>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Responding to screen size changes</h2>
            <p>The IDE watches the viewport width to know if it&apos;s on a phone. This uses a browser API (<code>window.matchMedia</code>) — which can only be called in an effect:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'components/IDE.tsx — media query effect',
          code: `useEffect(() => {
  const mq = window.matchMedia('(max-width: 767px)');
  const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);  // cleanup
}, []);`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p>The empty <code>[]</code> dependency array means "run once, when the component first mounts". The function returned at the end is a <strong>cleanup function</strong> — React calls it when the component unmounts (is removed from the page), so we don&apos;t leave orphaned event listeners behind.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Saving to localStorage</h2>
            <p>These effects persist state to the browser&apos;s local storage so files survive a page refresh:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'components/IDE.tsx — persist effects',
          code: `useEffect(() => {
  saveToLocalStorage('fj-ide-files', files);
}, [files]);   // re-run whenever 'files' changes

useEffect(() => {
  saveToLocalStorage('fj-ide-sources', sources);
}, [sources]);

useEffect(() => {
  saveToLocalStorage('fj-ide-sidebar-collapsed', sidebarCollapsed);
}, [sidebarCollapsed]);`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p>Each effect has a single item in its dependency array. Whenever <code>files</code> changes (you add a file, rename one, type in the editor), the first effect re-runs and saves the new state.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Debouncing the share URL</h2>
            <p>The IDE encodes your code into the URL so you can share it. But updating the URL on every keystroke would be wasteful. The solution is <strong>debouncing</strong> — wait until the user has stopped typing for 1 second, then update:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'components/IDE.tsx — debounce effect',
          code: `useEffect(() => {
  if (shareTimerRef.current) clearTimeout(shareTimerRef.current);

  shareTimerRef.current = setTimeout(() => {
    const encoded = encodeShare(files);
    if (encoded.length < 200_000) {
      const url = new URL(window.location.href);
      url.hash = \`share=\${encoded}\`;
      window.history.replaceState(null, '', url.toString());
    }
  }, 1000);  // wait 1 second after the last change

  return () => {
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
  };
}, [files]);`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p>Every time <code>files</code> changes, the effect cancels the previous timer and starts a new 1-second countdown. If you keep typing, the timer resets. Only when you pause for a second does it run — this keeps the URL and browser history clean.</p>
            <p>The cleanup function cancels the timer when the component unmounts, preventing a timer from firing on an already-removed component.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Key takeaways</h2>
            <ul>
              <li><code>useEffect(() =&gt; {'{'} ... {'}'}, [deps])</code> runs code after React renders.</li>
              <li>The dependency array controls <em>when</em> the effect re-runs: <code>[]</code> = once on mount, <code>[x]</code> = whenever <code>x</code> changes.</li>
              <li>The return value is a cleanup function — called when the component unmounts or before the effect re-runs.</li>
              <li>Use effects for: DOM event listeners, timers, localStorage, network requests, subscriptions.</li>
            </ul>
          </>
        ),
      },
    ],
  },

  {
    id: 'api-routes',
    title: 'API Routes: The Backend',
    subtitle: 'Server-side code in a Next.js app',
    blocks: [
      {
        kind: 'prose',
        content: (
          <>
            <p>Web apps often need a <strong>backend</strong> — code that runs on the server, not in the browser. The browser can&apos;t run arbitrary system commands, read files from disk, or safely store secrets. A server can.</p>
            <p>Next.js has a built-in way to write backend code alongside your frontend: <strong>API routes</strong>. Any file in <code>app/api/</code> becomes an HTTP endpoint your browser can call with <code>fetch()</code>.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>The compile API route</h2>
            <p>When you click "Compile", the browser sends your code to <code>/api/compile</code>, which runs the real <code>fj</code> compiler binary on the server and returns the compiled bytecode. Here is how the browser makes that request:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'components/IDE.tsx — fetch call',
          code: `const res = await fetch('/api/compile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    files: files.map((f) => ({ name: f.name, content: f.content })),
  }),
});

const data = await res.json();  // { success, fjmBase64, stderr }

if (data.success && data.fjmBase64) {
  setCompiledFjm(data.fjmBase64);  // store the compiled binary
  setCompileStatus('success');
} else {
  setCompileStatus('error');
}`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p><code>fetch()</code> is the browser&apos;s built-in function for making HTTP requests. It returns a <strong>Promise</strong> — a value that will be resolved in the future. The <code>await</code> keyword pauses execution until the response arrives.</p>
            <p>The request sends the files as JSON in the body. The response comes back as JSON too: <code>{'{'} success: true, fjmBase64: "..." {'}'}</code>.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>The server-side handler</h2>
            <p>Here is the API route that handles that request — <code>app/api/compile/route.ts</code>:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'app/api/compile/route.ts',
          code: `export async function POST(req: NextRequest) {
  // 1. Parse the incoming JSON body
  const body = await req.json();
  //   body.files = [{ name: 'hello.fj', content: '...' }, ...]

  // 2. Write each file to a temporary directory on the server
  const tempDir = join(tmpdir(), \`fj-compile-\${uuidv4()}\`);
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
}`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p>The API route is just an <code>async</code> function named <code>POST</code> (matching the HTTP method). It receives a <code>Request</code> object and returns a <code>Response</code>. Everything in between is ordinary Node.js — file system access, running shell commands, reading output.</p>
            <p>The browser never runs this code. It only sees the final JSON response. This is what makes APIs powerful: the server can run anything, the browser just gets the result.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Key takeaways</h2>
            <ul>
              <li>API routes in Next.js live in <code>app/api/</code> and become HTTP endpoints.</li>
              <li>The browser calls them with <code>fetch(url, {'{'} method: &apos;POST&apos;, body: JSON.stringify(data) {'}'})</code>.</li>
              <li><code>await fetch(...)</code> waits for the network response before continuing.</li>
              <li>The server-side handler can do anything: run binaries, read files, access databases.</li>
              <li>The browser only sees what the handler returns via <code>NextResponse.json(...)</code>.</li>
            </ul>
          </>
        ),
      },
    ],
  },

  {
    id: 'websockets',
    title: 'WebSockets: Real-Time',
    subtitle: 'Streaming output as it happens',
    blocks: [
      {
        kind: 'prose',
        content: (
          <>
            <p>Regular HTTP (what <code>fetch()</code> uses) is <strong>request-response</strong>: the browser asks, the server answers, the connection closes. You can&apos;t use it for streaming — if a program is running and producing output continuously, you&apos;d have to keep asking "is there new output?" every second.</p>
            <p><strong>WebSockets</strong> solve this. They open a persistent, two-way connection between the browser and server. Either side can send a message at any time. The server can push output to the browser <em>the moment it arrives</em>.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Opening the connection and sending the program</h2>
            <p>When you click "Run", the IDE opens a WebSocket to <code>/ws/run</code> and sends the files:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'components/IDE.tsx — opening the WebSocket',
          code: `const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(\`\${wsProto}//\${window.location.host}/ws/run\`);

ws.onopen = () => {
  // Connection is open — send the files to compile and run
  ws.send(
    JSON.stringify({
      type: 'run_fj',
      files: files.map((f) => ({ name: f.name, content: f.content })),
      initialStdin: stdinContent || undefined,
    }),
  );
};`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p><code>new WebSocket(url)</code> opens the connection. <code>ws.onopen</code> is a callback that fires when the connection is established and ready. Then <code>ws.send()</code> sends a JSON message to the server — in this case, the files to run.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Receiving streaming output</h2>
            <p>The server sends a message for each chunk of stdout/stderr. The browser receives them in <code>ws.onmessage</code>:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'components/IDE.tsx — ws.onmessage',
          code: `ws.onmessage = (event) => {
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
      addLine('info', \`✓ Process exited (code \${msg.code}) — \${elapsed}s\`);
      setRunStatus('exited');
      break;
    case 'error':
      addLine('error', msg.data);
      setRunStatus('error');
      break;
  }
};`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>The server side: piping program output</h2>
            <p>On the server (in <code>server.ts</code>), the FlipJump binary is started as a child process. Its stdout and stderr are piped directly to the WebSocket:</p>
          </>
        ),
      },
      {
        kind: 'code',
        snippet: {
          file: 'server.ts — streaming child process output',
          code: `child.stdout?.on('data', (chunk: Buffer) => {
  const text = outDec.write(chunk);      // decode UTF-8 bytes
  if (text) send({ type: 'stdout', data: text });  // push to browser
});

child.stderr?.on('data', (chunk: Buffer) => {
  const text = errDec.write(chunk);
  if (text) send({ type: 'stderr', data: text });
});

child.on('close', (code, signal) => {
  send({ type: 'exit', code, signal });  // tell browser the process ended
});`,
        },
      },
      {
        kind: 'prose',
        content: (
          <>
            <p>The <code>child.stdout?.on(&apos;data&apos;, ...)</code> event fires every time the running program writes to stdout. The server immediately forwards that chunk to the browser via the WebSocket. This is why you see output appear in the terminal as the program runs — not all at once at the end.</p>
            <p>The whole chain is: FlipJump program → Node.js child process stdout → WebSocket message → browser <code>onmessage</code> handler → React state update → terminal re-render.</p>
          </>
        ),
      },
      {
        kind: 'prose',
        content: (
          <>
            <h2>Key takeaways</h2>
            <ul>
              <li>HTTP is request-response (one question, one answer, connection closes). WebSockets are persistent two-way channels.</li>
              <li><code>new WebSocket(url)</code> opens a connection; <code>ws.send()</code> sends a message; <code>ws.onmessage</code> receives them.</li>
              <li>Messages are JSON strings — both sides use <code>JSON.stringify()</code> to send and <code>JSON.parse()</code> to receive.</li>
              <li>The server pipes child process output into the WebSocket in real time, making streaming output possible.</li>
            </ul>
          </>
        ),
      },
    ],
  },
];
