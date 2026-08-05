# Task 04: Site furniture

## Goal

The things a reader and a search engine expect from a documentation site, none of
which tina4press emits today.

## Context

Measured on the built tina4.com, 2026-08-05, 288 pages.

| Artefact | State |
|---|---|
| Pages sharing one identical meta description | **268 of 288** |
| Pages with `rel="canonical"` | **0** |
| Pages with any Open Graph or Twitter tag | **0** |
| `sitemap.xml`, `robots.txt`, `404.html` | **all missing** |
| Prev / next page navigation | **absent** |
| Broken internal links shipped silently | **16** |
| Dead `#anchor` targets shipped silently | **126** |

The link rot is the sharpest one. `fixContentLink()` in
[src/build.js](tina4press/src/build.js) rewrites every internal `.md` link to a final
URL and never checks that the target exists, so a docs site quietly rots and nobody
is told. `js/gallery/index.html` points at 16 `/gallery/*` pages that do not exist.

## Scope

- [ ] **Auto-derive the meta description** from the first paragraph when frontmatter
      omits it. One change fixes 268 pages.
- [ ] **Link checker in the build.** Every rewritten internal link and every
      `#anchor` is resolved against the page set. Report by default; `--strict`
      fails the build. This is the gate that keeps the number at zero once fixed.
- [ ] `rel="canonical"` per page (needs `config.hostname`)
- [ ] Open Graph + Twitter card: `og:title`, `og:description`, `og:url`, `og:type`,
      `twitter:card`. A docs link pasted into Slack is often the first impression.
- [ ] `og:image`: site-wide default via config, per-page override via frontmatter.
      No build-time card generation - not worth a rasteriser dependency.
- [ ] `sitemap.xml` and `robots.txt` from the page list already in `build()`
- [ ] `404.html` rendered in the theme, so a bad link keeps the reader on the site
      with nav and search
- [ ] **Prev / next footer**, derived from the resolved sidebar order - no new config
- [ ] Render the breadcrumb. `crumbFor()` already computes one for the search index
      and then throws it away.
- [ ] Last-updated from git mtime, opt-in

## Tests

- [ ] `meta: a page without frontmatter description gets one from its first paragraph`
- [ ] `meta: frontmatter wins over the derived description` (negative)
- [ ] `links: a link to a missing page is reported`
- [ ] `links: a valid relative link is not reported` (negative)
- [ ] `links: a dead #anchor is reported`
- [ ] `links: --strict exits non-zero when a link is broken`
- [ ] `sitemap: every non-home page appears exactly once`
- [ ] `prevnext: first page has no prev, last has no next` (negative)
- [ ] `og: canonical and og:url agree and respect base`

## Bugs

- [ ] 16 broken internal links ship silently (all on `js/gallery/index.html`)
- [ ] 126 dead `#anchor` targets ship silently
- [ ] 268 pages share one meta description

## Commits

- (none yet)

## Status: Not started
