# tina4press master plan

The overview of every task and its status. One detailed plan per task in this
folder. Nothing lands off-plan.

**Repo:** tina4stack/tina4press (private) - **Branch:** `main` - **Version:** 0.1.11
**Released:** v0.1.11 tagged and pushed 2026-08-05. **npm still shows 0.1.10** - this
repo has no publish workflow, so `npm publish` is a manual step.
**Consumer:** tina4-documentation builds the live tina4.com with it (271 pages).

## Why this exists

tina4press replaced VitePress for tina4.com on 2026-07-25. VitePress renders
Markdown through Vue, so `{{ }}` interpolates in prose AND in code blocks, and
Frond `{% %}` fights the tooling meant to display it. tina4press runs no template
engine over content. **Code is sacred.** That is the one rule everything else
serves.

It is also lighter. VitePress ships the Vue runtime plus its router and theme to
every reader. tina4press ships 27 KB of tina4-js, 13 KB of theme JS and 21 KB of
CSS, all static HTML underneath, and the whole site works with JavaScript off.

## Task status

| # | Task | Plan | Status |
|---|------|------|--------|
| 00 | Test harness and corpus conformance | [00-test-harness.md](tina4press/plan/00-test-harness.md) | ⚠️ Partial |
| 01 | Parser correctness | [01-parser-correctness.md](tina4press/plan/01-parser-correctness.md) | ✅ Done (v0.1.11) |
| 02 | Theming that does not break | [02-theming.md](tina4press/plan/02-theming.md) | ✅ Done |
| 03 | i18n on tina4-js localization | [03-i18n.md](tina4press/plan/03-i18n.md) | ❌ BUILD |
| 04 | Site furniture (nav, SEO, social) | [04-site-furniture.md](tina4press/plan/04-site-furniture.md) | ❌ BUILD |
| 05 | Delivery and performance | [05-delivery-performance.md](tina4press/plan/05-delivery-performance.md) | ❌ BUILD |
| 06 | Accessibility and reading polish | [06-accessibility.md](tina4press/plan/06-accessibility.md) | ❌ BUILD |
| 07 | Repo hygiene and release | [07-repo-hygiene.md](tina4press/plan/07-repo-hygiene.md) | ⚠️ Partial |

## VitePress parity dashboard

tina4press has one job: be a better docs renderer than the thing it replaced.
Parity here is measured against VitePress, not against four languages.

| Capability | VitePress | tina4press | Note |
|---|---|---|---|
| Code blocks untouched by a template engine | ❌ | ✅ | the reason this exists |
| Fenced highlighting, line ranges, titles | ✅ | ✅ | 13 languages, build-time |
| Containers (tip/warning/details) | ✅ | ✅ | |
| Code groups, content tabs, cards, steps | ✅ | ✅ | |
| Auto sidebar from folders | ✅ | ✅ | section-scoped, stem-grouped |
| Client-side search | ✅ | ✅ | 748 KB index, task 05 |
| Dark / light, no flash | ✅ | ✅ | |
| Home hero layout | ✅ | ✅ | |
| Clean URLs | ✅ | ✅ | plus loop-free .htaccess |
| Markdown correctness | ✅ | ✅ | task 01, 42 regression tests, v0.1.11 |
| Prev / next page nav | ✅ | ❌ | task 04 |
| sitemap.xml | ✅ | ❌ | task 04 |
| Canonical + Open Graph | ✅ | ❌ | task 04 |
| Per-page meta description | ✅ | ⚠️ | 268 of 288 pages share one, task 04 |
| Dead-link checking | ✅ | ❌ | 16 broken + 126 dead anchors ship silently, task 04 |
| Content-hashed assets | ✅ | ❌ | stale CSS after deploy, task 05 |
| i18n | ✅ | ❌ | task 03 |
| Custom CSS hook | ✅ | ✅ | `customCss` |
| Layout slots | ✅ (Vue) | ✅ | 7 named slots, plain HTML strings not components |
| Ships a framework runtime to the reader | ❌ Vue | ✅ none | 27 KB tina4-js, no Vue |

## Bugs

Open bugs live in their task plan's Bugs section. Nothing is closed without a
named regression test that failed before the fix.

- [ ] 16 broken internal links and 126 dead anchors ship silently (task 04)
- [ ] A theme change serves stale CSS to returning readers (task 05)
- [ ] `rmSync(outPath)` has no guard; a typo in `outDir` deletes the source (task 05)
- [ ] Dev server binds 0.0.0.0 and allows `..` traversal (task 05)

## Status: In Progress
