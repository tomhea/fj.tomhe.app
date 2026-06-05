# Chapter 13 — SEO & the Semantic Web

> **Previous:** [Chapter 12 — Static Sites](12-static-sites.md) | **Next:** [Chapter 14 — Shipping It](14-shipping.md)

---

A documentation site is only useful if people can **find** it, and looks far more trustworthy when a shared link unfurls into a rich preview instead of a bare URL. Both come down to **metadata** — invisible tags in each page's `<head>` that search engines and chat apps read. The IDE never needed this; a docs site lives or dies by it. The `flipjump-docs` repo handles it with a second custom Sphinx extension, `seo`.

---

## Why pages describe themselves

Google, Slack, Discord, and the rest don't read your page the way a human does — they read structured tags. The `seo` extension injects those tags on **every** page, hooking the same kind of lifecycle event you met in Chapter 12:

```python
# docs/_ext/seo/__init__.py
def setup(app):
    app.add_config_value("seo_site_name", "FlipJump Docs", "env")
    ...
    app.connect("html-page-context", _on_html_page_context)
```

`html-page-context` fires once per page, just before it's rendered — the perfect spot to add tags to the `<head>`.

---

## A description for every page

The most important tag is `<meta name="description">` — the grey snippet Google shows under each result. The extension picks one automatically: a hand-written override if there is one, otherwise the page's **first real paragraph**, pulled straight out of the doctree from Chapter 12:

```python
# docs/_ext/seo/__init__.py
parts = [
    f'<meta name="description" content="{esc(description)}">',
    f'<meta name="keywords" content="{esc(KEYWORDS)}">',
    '<meta name="robots" content="index, follow, max-image-preview:large">',
    ...
]
```

The description is trimmed to ~160 characters — Google's snippet limit — so it's never cut off with an ugly `…`. The `robots` tag explicitly tells crawlers "yes, index this page."

---

## Social cards: Open Graph & Twitter

The same block emits **Open Graph** (`og:*`) and **Twitter Card** tags. These are what turn a pasted link into a card with a title, description, and image in Slack, Discord, iMessage, LinkedIn, and X:

```python
# docs/_ext/seo/__init__.py
f'<meta property="og:title" content="{esc(page_title)}">',
f'<meta property="og:description" content="{esc(description)}">',
f'<meta property="og:image" content="{esc(og_image)}">',
'<meta name="twitter:card" content="summary_large_image">',
```

`og:image` is the big preview picture; `summary_large_image` asks Twitter/X to use the large card format. Set these once in the build and every shared link looks intentional.

---

## Structured data: telling Google what the page *is*

Beyond a description, you can hand search engines machine-readable facts as **JSON-LD** — a little JSON blob following the [schema.org](https://schema.org) vocabulary. The landing page declares itself a `WebSite` with a built-in search action, which is what can earn a "sitelinks search box" in Google results:

```python
# docs/_ext/seo/__init__.py
website_jsonld = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": site_name,
    "url": site_url,
    "potentialAction": {
        "@type": "SearchAction",
        "target": {
            "@type": "EntryPoint",
            "urlTemplate": site_url + "search.html?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
    },
}
```

This is the **semantic web** in miniature: not just "here's some text," but "this *is a website*, and here's *how to search it*."

---

## Sitemaps and a friendly 404

Two more discoverability pieces come from off-the-shelf extensions wired up in `conf.py`:

```python
# docs/source/conf.py
html_baseurl = "https://fjdocs.tomhe.app/"

notfound_pagename = "404"
```

- **`sphinx_sitemap`** uses `html_baseurl` to write a `sitemap.xml` listing every page — the file you submit to Google so it knows what exists.
- **`notfound.extension`** builds a styled **404 page** with the site's normal navigation, so a bad link still lets visitors find their way instead of hitting a dead end.

---

## Key takeaways

- Search engines and chat apps read **metadata in `<head>`**, not the visible page — a docs site has to provide it deliberately.
- An `html-page-context` hook injects a `<meta name="description">` per page, auto-extracted from the doctree's first paragraph and trimmed to Google's ~160-char snippet limit.
- **Open Graph** and **Twitter Card** tags are what make shared links unfurl into rich preview cards.
- **JSON-LD** structured data (schema.org) tells search engines what a page *is* — here, a searchable `WebSite` — enabling richer results.
- A **sitemap** (`sphinx_sitemap` + `html_baseurl`) and a **custom 404** round out discoverability.

---

> **Next:** [Chapter 14 — Shipping It](14-shipping.md)
