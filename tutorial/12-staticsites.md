# Chapter 12 — Static Sites & Extending the Build

> **Previous:** [Chapter 11 — Testing](11-testing.md) | **Next:** [Chapter 13 — SEO & the Semantic Web](13-seo.md)

---

Everything so far has used *this* IDE's source. For these last three chapters we step over to its sister project — the **documentation site** at [fjdocs.tomhe.app](https://fjdocs.tomhe.app) (repo: `flipjump-docs`). It's worth a look because it's built on a completely different stack from the app you've been studying, and it shows off web concepts the IDE never needed: static-site generation, SEO, and a real deploy pipeline.

---

## A different kind of web app: the static site

The IDE is a *live* app — a Node server runs continuously, answering each request as it arrives (Chapters 7–8). The docs site is the opposite: a **static site**. It's built **once** into a folder of plain `.html` files, and those files are copied to a server that just hands them out. No Node process, no per-request code. This is what a **static-site generator (SSG)** does — and it's how most documentation, blogs, and marketing sites work.

---

## The toolchain: Sphinx + MyST + Furo

The generator here is **Sphinx** (a Python tool). Its config file lists the pieces:

```python
# docs/source/conf.py
extensions = [
    "myst_parser",
    "sphinx_design",
    "sphinx_sitemap",
    "notfound.extension",
    "fj_stl_extract",
    "seo",
]

html_theme = "furo"
```

- **`myst_parser`** lets you write pages in Markdown (instead of Sphinx's older reStructuredText).
- **`furo`** is the theme — the design system that gives every page its layout, dark mode, and sidebar (think Tailwind + components from Chapter 5, but pre-built).
- The last two — **`fj_stl_extract`** and **`seo`** — are *custom local extensions* in this repo. More on those below and in Chapter 13.

---

## Markdown that compiles to a document tree

MyST is Markdown plus **directives** (block features) and **roles** (inline ones). A page can write:

````markdown
```{toctree}
:maxdepth: 1

cheat-sheet
cli
```
````

That `{toctree}` isn't HTML — Sphinx parses every page into a structured **document tree** (a "doctree") first, then renders that tree to HTML. Holding the page as a tree (rather than a string of HTML) is what lets tools read and transform it later — in Chapter 13 you'll see the SEO extension pull a page's first paragraph straight out of this tree. It's the same shift you met with JSX in Chapter 2, taken one step further: the content is *data*, not markup text.

---

## Building the site

One command turns the whole `source/` tree into HTML:

```bash
cd docs && make html
```

The `Makefile` passes a crucial flag:

```make
# docs/Makefile
SPHINXOPTS    ?= -W --keep-going
```

`-W` means **treat warnings as errors**. A broken cross-link or a page missing from the navigation doesn't just warn — it fails the build. That turns "did the docs compile correctly?" into a yes/no test (which Chapter 14 wires into CI). The finished HTML lands in `docs/_build/html/`.

---

## Extending the build with a hook

The docs site has hundreds of standard-library reference pages, and **nobody writes them by hand** — they're generated from the FlipJump source during the build. That's what the custom `fj_stl_extract` extension does, and it plugs into Sphinx through a single entry point:

```python
# docs/_ext/fj_stl_extract/sphinx_ext.py
def setup(app):
    app.add_config_value("fj_stl_root", "../../vendor/flip-jump/flipjump/stl", "env")
    app.add_config_value("fj_stl_output", "stl", "env")
    app.add_lexer("fj", FlipJumpLexer)
    app.connect("builder-inited", _on_builder_inited)
    ...
```

Every Sphinx extension exposes a `setup(app)` function. The key line is `app.connect("builder-inited", ...)`: it registers your code to run at a **specific moment in the build's lifecycle** — here, the instant the builder starts, *before* Sphinx reads the source pages, so the generated reference pages exist in time to be included.

If that "run my code at a defined point in someone else's lifecycle" idea feels familiar, it should: it's the build-time twin of the `middleware.ts` you saw in Chapter 10. Middleware hooks the *request* lifecycle; an extension hooks the *build* lifecycle.

---

## Key takeaways

- A **static-site generator** builds a site into plain HTML files once, then a server just serves them — no per-request code, unlike the IDE's live server.
- This site uses **Sphinx** (the generator) + **MyST** (Markdown) + **Furo** (the theme), configured in `conf.py`.
- MyST pages compile to a **doctree** — a structured tree, not an HTML string — which later tools can read and transform.
- `make html` builds with `-W`, so warnings (like broken links) become hard errors — the build doubles as a test.
- A Sphinx **extension** is a `setup(app)` function that uses `app.connect(event, …)` to run code at a point in the build lifecycle — the build-time analog of request middleware.

---

> **Next:** [Chapter 13 — SEO & the Semantic Web](13-seo.md)
