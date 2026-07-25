# tina4press

A tiny, **zero-Vue** static site generator for documentation, built on
[tina4-js](https://tina4.com). VitePress-like ergonomics, but nothing scans your
content for template syntax — so documenting Tina4's own Frond/Twig templates
just works.

## Why

VitePress renders Markdown through Vue, so `{{ }}` in prose (or even inside a
code block) gets interpolated and Frond/Twig `{% %}` fights the tooling.
tina4press has **no template engine on your content**: fenced and inline code
are HTML-escaped and emitted verbatim. Code is sacred.

```bash
npm i -D tina4press
npx tina4press dev   my-docs      # live-reload dev server
npx tina4press build my-docs      # static site -> my-docs/dist
```

## Features

- **Code-safe markdown** — `{% live %}`, `{{ user.name }}`, JSX, raw `<script>` render literally, no `v-pre`.
- **Build-time syntax highlighting** — python / php / ruby / js / ts / sql / bash / json, plus Frond/Twig delimiters. Line highlighting (` ```js{2,4} `) and code titles.
- **Auto sidebar** from your folder structure (numeric prefix / `order:` / title).
- **Context search** — ⌘K, ranked, with highlighted snippets. Pure client-side, no server.
- **Dark / light** — persisted, no flash of the wrong theme.
- **Custom containers** — `::: tip`, `info`, `warning`, `danger`, `details`.
- **Live-reload dev server**, zero external runtime dependencies (only tina4-js ships to the browser).

## Project layout

```
my-docs/
  tina4press.config.js       # optional
  docs/
    index.md
    guide/getting-started.md
    public/                  # static files, copied as-is
```

## Config (`tina4press.config.js`, all optional)

```js
export default {
  title: "My Docs",
  description: "…",
  base: "/",                 // set to "/repo/" for GitHub Pages subpaths
  srcDir: "docs",
  themeConfig: {
    nav: [{ text: "Guide", link: "guide/getting-started.html" }],
    sidebar: null,           // null = auto; or { '/guide/': [...] }
    search: true,
    footer: "MIT licensed",
  },
};
```

## Status

MVP. Builds the full tina4.com documentation (282 pages) in under a second.
Not yet implemented: a `home` hero layout, tabbed `code-group` (renders stacked),
and i18n. Contributions welcome.

## License

MIT © Andre van Zuydam
