# Task 05: Delivery and performance

## Goal

Stop shipping stale CSS, stop shipping three quarters of a megabyte to open a
search box, and stop the build being able to delete the source tree.

## Context

Measured on the built tina4.com, 2026-08-05.

| | Value |
|---|---|
| Build | 271 pages in 982ms |
| `assets/search-index.json` | **748 KB**, fetched whole on the first Cmd+K |
| `assets/theme.css` | 21 KB, referenced as `/assets/theme.css`, **no hash** |
| `assets/client.js` | 13 KB, **no hash** |
| `assets/tina4js.min.js` | 27 KB, **no hash** |

## Scope

- [ ] **Content-hash the assets.** This is a live production defect, not a
      nicety: pages reference `/assets/theme.css` with no hash and no version, so
      after a theme change every returning reader and every CDN edge serves the old
      CSS against the new HTML. Emit `theme.<hash>.css` and let the hash do the
      cache busting.
- [ ] **Split the search index.** Load a titles-and-headings index eagerly for
      instant results, fetch page bodies lazily or trim them hard. Target under
      100 KB for the initial fetch, down from 748 KB.
- [ ] **Search relevance.** Scoring is `indexOf` with a flat +10 for a title hit.
      Add word-boundary and prefix weighting, and index headings as their own
      records so a hit deep-links to `#the-section` instead of the top of a long page.
- [ ] **Incremental dev rebuild.** `dev()` rebuilds all 271 pages on every save.
      Rebuild the changed page plus anything whose sidebar or search record moved.
- [ ] **Guard the output wipe.** `build()` calls
      `rmSync(config.outPath, {recursive:true, force:true})` with no checks. A typo
      in `outDir` deletes the source tree. Refuse when outPath is the repo root, is
      srcDir, or is an ancestor of srcDir.
- [ ] **Harden the dev server.** It binds 0.0.0.0 and joins the decoded request path
      straight onto outPath, so `..` escapes the output directory. Bind 127.0.0.1 by
      default and reject traversal.
- [ ] Carbonah before/after on the build, per the green-code discipline. Fewer bytes
      shipped per reader is the whole point of not shipping Vue.

## Tests

- [ ] `assets: the emitted css filename carries a content hash`
- [ ] `assets: the same input produces the same hash` (stability)
- [ ] `assets: changed css changes the hash and every page reference` (negative)
- [ ] `search: the eager index is under the size budget`
- [ ] `search: a heading match deep-links to its anchor`
- [ ] `build_guard: outDir equal to srcDir refuses to run` (negative)
- [ ] `build_guard: outDir as an ancestor of srcDir refuses to run` (negative)
- [ ] `dev: a request containing .. cannot read outside outPath` (negative)
- [ ] `dev: binds loopback by default`

## Bugs

- [ ] A theme change serves stale CSS to every returning reader
- [ ] 748 KB fetched to open the search box
- [ ] `rmSync(outPath)` unguarded; a typo in `outDir` deletes source
- [ ] Dev server binds all interfaces and allows path traversal

## Commits

- (none yet)

## Status: Not started
