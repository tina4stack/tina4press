# tina4press

A static site generator for documentation. No build-time dependencies, one small
library in the browser, and a parser that never touches your code samples.

## Why this exists

VitePress renders Markdown through Vue, and Vue owns the mustache. Write
`{{ user.name }}` in a paragraph and it becomes an interpolation error. Put
`{% live %}` inside a fenced block and the tooling meant to display your template
starts fighting it instead. Documenting a template engine in VitePress means
scattering `v-pre` through the source and hoping you caught every case.

tina4press runs no template engine over your content. Fenced blocks and inline
code are pulled out before any rule runs, escaped once, and emitted as written.
Frond, Twig, Handlebars, JSX, a raw `<script>` tag: all of it survives.

Code is sacred. That is the whole design.

## Install

```bash
npm i -D tina4press
```

Node 18 or newer. The package pulls one runtime dependency, `tina4js`, which
ships to the browser at 27 KB.

## Quick start

```bash
npx tina4press dev   my-docs      # live-reload server on :5180
npx tina4press build my-docs      # static output in my-docs/dist
```

The build prints one line when it finishes:

```
tina4press: built 271 page(s) in 949ms -> docs/.vitepress/dist
```

That number is the tina4.com documentation, which this tool renders in
production.

## Project layout

```
my-docs/
  tina4press.config.js       # optional
  docs/                      # srcDir
    index.md
    guide/
      01-getting-started.md
      02-routing.md
    public/                  # copied to the output root, untouched
      logo.svg
```

Markdown in `docs`. Static files in `docs/public`. Output in `dist`. Change any
of the three in config.

## CLI

| Command | What it does |
|---|---|
| `tina4press build [dir]` | Build the site in `dir`. Defaults to the current directory. |
| `tina4press dev [dir] [--port=N]` | Build, serve, watch, and reload the browser on change. Default port 5180. |
| `tina4press help` | Print usage. |

The dev server watches your source tree and skips the output directory, so a
build cannot retrigger itself. It pushes reloads over Server-Sent Events: no
websocket, no client library, no second port.

## Configuration

Drop a `tina4press.config.js` or `tina4press.config.mjs` beside your `docs`
folder. Every key is optional.

```js
export default {
  title: "My Docs",
  description: "What this site is about",
  base: "/",                   // "/repo/" for a GitHub Pages subpath
  srcDir: "docs",
  outDir: "dist",
  cleanUrls: true,             // /guide/routing/ instead of /guide/routing.html
  head: [                      // VitePress format: [tag, attrs, innerHTML?]
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
  ],
  themeConfig: {
    nav: [{ text: "Guide", link: "/guide/" }],
    sidebar: null,             // null = auto from folders
    logo: "/logo.svg",
    footer: "MIT licensed",
    search: true,
    editLinkBase: "https://github.com/org/repo/edit/main/docs/",
  },
};
```

### Top-level keys

| Key | Default | Meaning |
|---|---|---|
| `title` | `"Tina4press"` | Site name. Shows in the header and every page title. |
| `description` | `"Docs built with tina4press"` | Fallback meta description. |
| `base` | `"/"` | URL prefix. Set it when the site lives under a subpath. |
| `srcDir` | `"docs"` | Where the Markdown lives, relative to the config file. |
| `outDir` | `"dist"` | Where the HTML lands, relative to the config file. |
| `cleanUrls` | `false` | Directory-style URLs. See below. |
| `head` | none | Extra tags for `<head>`, as `[tag, attrs, inner]` triples. |

### themeConfig keys

| Key | Meaning |
|---|---|
| `nav` | Header links: `[{ text, link }]`. |
| `sidebar` | An array used on every page, or an object keyed by path prefix. `null` turns on the automatic sidebar. |
| `search` | Set `false` to drop the search button, modal, and index. |
| `logo` | Path to a logo. Doubles as the favicon. |
| `footer` | HTML for the page footer. |
| `editLinkBase` | Base URL for the "Edit this page" link. The page path is appended. |
| `sectionLabels` | Better names for top-level folders: `{ js: "Tina4 JS" }`. |
| `sidebarGroups` | Group a section's chapters by name. See below. |
| `sidebarRanges` | Group one section's chapters by leading file number. |
| `sidebarRangesDefault` | The same table applied to every ungrouped section. |
| `colors` | Theme colours. See Theming. |
| `analytics` | A Google tag: `"G-XXXX"` or `{ ga: "G-XXXX" }`. |
| `chat` | The built-in question box. See Chat. |

## Frontmatter

A small YAML subset: scalars, nested maps, sequences, and `#` comments. It reads
what a docs site needs and skips the rest of YAML.

```markdown
---
title: Routing
description: How requests find their handler
order: 2
---

# Routing
```

| Key | Effect |
|---|---|
| `title` | Overrides the page title. Without it the first `# heading` wins, then the filename. |
| `description` | Per-page meta description. |
| `order` | Sidebar position for files with no numeric prefix. |
| `layout` | `doc` (default) or `home`. |

### Home layout

`layout: home` drops the sidebar and the table of contents, renders a hero, and
leaves the page out of the search index.

```markdown
---
layout: home
hero:
  name: Tina4
  text: This is not a framework
  tagline: One toolkit, four languages, zero runtime dependencies
  image:
    src: /logo.svg
    alt: Tina4
  actions:
    - text: Get started
      link: /guide/
      theme: brand
    - text: GitHub
      link: https://github.com/tina4stack
      theme: alt
features:
  - icon: "*"
    title: Code is sacred
    details: Template syntax in a code block renders as written.
---
```

An SVG hero loads through `<object>`, so an animated logo keeps its embedded
script running. Everything else loads through `<img>`.

## Writing content

### Code blocks

The info string carries a language, highlighted lines, a filename, and a note.

````markdown
```js{2,4-6} title="app.js" desc="Wires the login form"
const app = start();
app.get("/login", showForm);
```
````

Highlighted lines take a `{2,4-6}` range list. `title=` renders a filename bar
and `desc=` adds a note beside it. Every block gets a copy button.

### Syntax highlighting

Highlighting runs at build time, one line at a time, over already-escaped text.
Nothing in a code block can execute.

Supported: `python`, `php`, `ruby`, `javascript` (`js`), `typescript` (`ts`),
`nodejs`, `sql`, `bash` (`sh`), `json`, `yaml` (`yml`), `pascal` (`delphi`,
`dpr`), and `html` (`twig`, `frond`, `handlebars`).

The HTML mode colours tags, attributes, quoted values, and comments, then
colours Frond `{% %}` and `{{ }}` delimiters without reading what sits between
them. An unknown language renders as plain escaped text, which is the safe
result rather than a broken one.

### Containers

```markdown
::: tip
Callouts take an optional custom title after the name.
:::

::: warning Read this first
Body text.
:::
```

`tip`, `info`, `note`, `warning`, and `danger` render as callouts. `details`
renders a collapsible block. Any other name renders as a plain grouped `<div>`,
so an unknown container never breaks a build.

### Tabs, cards, and steps

Sections inside these containers start with `== Label`.

```markdown
::: tabs
== npm
Install with npm.
== pnpm
Install with pnpm.
:::

::: cards
== Fast
271 pages in under a second.
== Small
No build-time dependencies.
:::

::: steps
1. Install the package.
2. Write a page.
3. Run the build.
:::
```

A card title that opens with an emoji renders that emoji as the card icon.

### Code groups

````markdown
::: code-group
```js title="app.js"
start();
```
```python title="app.py"
start()
```
:::
````

Each block becomes a tab. The tab label is the block's `title=`, falling back to
its language.

### Everything else

Headings get an id and a permalink anchor. Tables support alignment. Blockquotes,
horizontal rules, nested lists, images, and inline HTML work as expected. The
table of contents collects `h2` and `h3`.

Internal links can point at either the `.md` source or the built `.html`, by a
relative or an absolute path. tina4press rewrites them to match your URL mode, so
a link that works in your editor works on the site.

## The sidebar

Leave `themeConfig.sidebar` as `null` and the sidebar builds itself from your
folders. It is scoped to the section, so a reader inside `/js/` sees the JS
chapters and nothing else. Order comes from a numeric filename prefix
(`01-intro.md`), then `order:` in frontmatter, then the title.

To group a section's chapters, name the groups and list their file stems:

```js
themeConfig: {
  sectionLabels: { js: "Tina4 JS" },
  sidebarGroups: {
    js: [
      { text: "Foundations", stems: ["intro", "signals", "components"] },
      { text: "Going further", stems: ["routing", "websockets"] },
    ],
  },
}
```

Stems ignore the numeric prefix, so `01-signals.md` has the stem `signals`.
Renumber a chapter and its group placement holds. Anything you leave out lands in
a collapsed "More" group rather than vanishing.

For full control, hand over an explicit sidebar keyed by path prefix. The longest
matching prefix wins, which matches VitePress.

```js
themeConfig: {
  sidebar: {
    "/guide/": [{ text: "Guide", items: [{ text: "Intro", link: "/guide/" }] }],
  },
}
```

## Search

Press Cmd+K or Ctrl+K. Type. Arrow keys move, Enter opens, Escape closes.

The index is a JSON file built alongside the pages and fetched the first time a
reader opens the box. Results rank title matches above body matches and show a
snippet with the term highlighted. No server, no API key, and no third party
watching what your readers look for.

Pages using `layout: home` stay out of the index.

## Chat

Point `themeConfig.chat` at a retrieval endpoint and a question box appears in
the corner.

```js
themeConfig: {
  chat: {
    api: "https://rag.example.com",
    askPath: "/v1/ask",         // default
    label: "Ask",
    placeholder: "Ask a question...",
    language: "python",          // optional; otherwise the first path segment
  },
}
```

The widget POSTs `{ query, language, k, stream }` and renders `answer` from the
response. If the payload carries a `sources` array, every entry with a `url`
becomes a citation link under the answer.

## Theming

The default theme is pink and blue: pink leads on links, active state and
buttons, blue supports on informational notes and the far end of the hero
gradient. Light mode is white with a whisper of violet in the neutrals; dark mode
is a deep indigo-plum rather than another blue-grey. Every colour in both themes
meets WCAG AA contrast on the surface it actually sits on, and a test enforces
that, so a palette tweak cannot quietly ship unreadable text.

Nothing in the stylesheet hardcodes a colour. A one-line brand override retints
the whole site, code blocks included.

```js
themeConfig: {
  colors: {
    light: { brand: "#d92b7a" },
    dark:  { brand: "#ff8ab8", bg: "#131022" },
  },
}
```

**The token names below are frozen.** New ones may be added; existing ones are
never renamed. VitePress renamed `--vp-c-brand` to `--vp-c-brand-1` and broke
every site's custom CSS at once. That will not happen here.

| Key | What it colours |
|---|---|
| `brand`, `brand2` | Primary accent and its partner |
| `onBrand` | Text sitting on a brand-coloured surface |
| `bg`, `bgSoft`, `bgMute` | Page, panel and inset backgrounds |
| `border`, `border2` | Hairlines and stronger edges |
| `fg`, `fg2`, `fg3` | Body, secondary and muted text |
| `warning`, `danger` | Callout accents |
| `codeBg`, `sel`, `shadow` | Code surface, selection, shadow tint |
| `code.*` | Syntax colours: `comment`, `string`, `keyword`, `number`, `fn`, `key`, `tag`, `var` |

Fonts and layout are separate, since neither is light/dark specific:

```js
themeConfig: {
  fonts: { body: "Inter, sans-serif", mono: "JetBrains Mono, monospace" },
  layout: { maxWidth: "1440px", contentWidth: "720px",
            sidebarWidth: "272px", tocWidth: "224px" },
}
```

### Custom CSS

```js
themeConfig: { customCss: "docs/custom.css" }   // or an array
```

Copied into the output and linked after `theme.css`, so your rules win by
cascade order instead of specificity guesswork.

### Slots

Inject your own markup at fixed points. A slot is an HTML **string**, or a
function of the page returning one. Never a component: component overrides are
what made VitePress theming break on upgrade, and a string cannot break.

```js
themeConfig: {
  slots: {
    headerEnd: '<a href="/changelog/">v3</a>',
    contentBottom: (page) => `<p>Edit ${page.relPath}</p>`,
  },
}
```

Available: `headerStart`, `headerEnd`, `sidebarTop`, `sidebarBottom`,
`contentTop`, `contentBottom`, `footer`. An unknown name is ignored.

Dark mode persists to `localStorage` and applies through an inline script before
first paint, so a returning reader never sees a white flash. The theme also
honours `prefers-reduced-motion` and ships print styles.

## Clean URLs

Set `cleanUrls: true` and `guide/routing.md` builds to
`guide/routing/index.html`, linked as `/guide/routing/`. Directory indexes are
served natively by Apache, Nginx, Netlify, Vercel, GitHub Pages, and S3, so the
output needs no server configuration to work.

Every build writes a small `.htaccess`. It disables MultiViews, sets
`DirectoryIndex`, and in clean mode carries 301s from the old `.html` paths. The
redirect rule matches `%{THE_REQUEST}`, the raw request line, which Apache does
not rewrite on internal subrequests. That detail is what stops `DirectoryIndex`
from looping the rule into a 500. Clean mode also writes a `_redirects` file for
Netlify and Cloudflare Pages.

Writing `.htaccess` on every build is deliberate. A host that extracts an archive
over the web root without clearing it leaves the previous `.htaccess` in place,
and stale rewrite rules outlive the deploy that created them.

## Deploying

Build, then publish the output directory. Nothing at runtime needs Node.

```bash
npx tina4press build .
```

The output holds your pages, `assets/theme.css`, `assets/client.js`,
`assets/tina4js.min.js`, `assets/search-index.json`, everything from
`docs/public`, and the `.htaccess`.

## Markdown support

Beyond the basics, tina4press handles the cases a docs site actually hits:

- Multi-line HTML blocks pass through untouched, body and closing tag intact
- HTML comments stay in the source and never reach the reader
- Autolinks: `<https://example.com>` and `<mailto:a@b.com>`
- List items hold block content, so a fenced block inside step 1 does not end the
  list or restart the numbering
- Task lists: `- [ ]` and `- [x]` render real checkboxes
- Backslash escapes: `\*not emphasis\*`
- A pipe inside inline code stays in its table cell

Every one of those is covered by a named regression test. Run `npm test`.

## Known limitations

Honest list, current as of 0.1.12. Tracked in
[`plan/MASTER.md`](plan/MASTER.md).

- **No i18n yet.** One locale per site. Planned on tina4-js localization, which is
  already in the bundle tina4press ships.
- **No prev and next page navigation.**
- **No `sitemap.xml`, `robots.txt`, or `404.html`.**
- **No canonical or Open Graph tags**, and a page without a frontmatter
  `description` falls back to the site description.
- **No dead-link checking.** A link to a page that does not exist is rewritten and
  shipped without a warning.
- **Asset filenames are not content-hashed**, so a theme change can serve stale CSS
  to a returning reader until their cache expires.
- **Setext headings** (`Title` over `=====`) are not supported. Use `#`.
- **Tabs have no ARIA roles or keyboard navigation**, and the search modal does
  not trap focus. Both are queued.

## Our Sponsors

**Sponsored with 🩵 by Code Infinity**

[<img src="https://codeinfinity.co.za/wp-content/uploads/2025/09/c8e-logo-github.png" alt="Code Infinity" width="100">](https://codeinfinity.co.za/about-open-source-policy?utm_source=github&utm_medium=website&utm_campaign=opensource_campaign&utm_id=opensource)

*Supporting open source communities <span style="color: #1DC7DE;">•</span> Innovate <span style="color: #1DC7DE;">•</span> Code <span style="color: #1DC7DE;">•</span> Empower*

## License

MIT. See [LICENSE](LICENSE).

Copyright (c) 2026 Andre van Zuydam. Sponsored by Code Infinity (Pty) Ltd.

*tina4press: documentation rendering for the Tina4 stack. [tina4.com](https://tina4.com)*
