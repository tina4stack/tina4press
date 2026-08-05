# Task 00: Test harness and corpus conformance

## Goal

Make it safe to change a hand-rolled parser that renders the public face of Tina4.

## Context

At 0.1.10 the repo had **zero tests and zero CI** while building the live
tina4.com. Every fix in task 01 is a change to regex-driven parsing, which is
exactly the code that regresses in silence.

## Scope

- [x] `test/` on `node:test` + `node:assert` - built into Node 18+, so the
      zero-dependency promise holds
- [x] `npm test` runs the suite
- [x] Named regression cases, positive AND negative per defect
- [ ] `prepublishOnly` runs the suite so a red tree cannot publish
- [ ] Corpus conformance test: build the real tina4-documentation tree and assert
      the invariants below, skipping with a loud message when the corpus is absent
- [ ] CI: GitHub Actions on Node 18/20/22. A run with skips is not a green run
- [ ] CommonMark subset score: run the spec examples for the constructs tina4press
      claims to support and publish the number in the README

## Conformance invariants

Asserted on the emitted HTML, **prose only** - `<pre>` and `<code>` are excluded
because escaping inside a code block is correct behaviour. Getting this wrong is
how the first audit produced two false positives (the JS keyword `undefined` inside
highlight spans, and sample HTML comments inside fenced blocks).

- [x] zero literal `<https?://` tags in prose
- [x] zero `&lt;!--` in prose
- [x] zero `</div></p>` style mis-nested closes
- [x] zero `<li>[ ]` literal task boxes
- [x] zero glued placeholder artefacts (`\w+undefined\w+`)
- [ ] zero broken internal links (16 today - task 04)
- [ ] zero dead `#anchor` targets (126 today - task 04)

## Deliberately NOT doing

Playwright or screenshot diffing. It would add a heavy dependency to a
zero-dependency tool. HTML structure assertions plus review through
`tina4press dev` covers the risk for a fraction of the code.

## Tests

No mocks anywhere. The parser is a pure function over a string, so every test
exercises the real code path; the corpus test runs the real build against real
files on disk.

## Verification

`node --test "test/*.test.js"` - **42 pass, 0 fail** on macOS, Node v24.9.0.

## Commits

- 51f2749  test: 42 named regression tests (shipped with the fixes they prove)
- fec70ca  chore: npm test + prepublishOnly gate

## Status: Partial. Suite + prepublish gate shipped in v0.1.11; CI, the corpus
conformance test and the CommonMark score are still open.
