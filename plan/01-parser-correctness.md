# Task 01: Parser correctness

## Goal

Stop the Markdown renderer eating content, and lock every defect out with a named
regression test.

## Context

`src/markdown.js` is a hand-rolled parser with no test suite, rendering the public
face of the whole Tina4 project. Eight defects were measured against the real
tina4.com corpus (271 pages) on 2026-08-05 before any fix landed. Counts below are
built pages out of 288, prose only - escaping inside a code block is correct
behaviour and was excluded from every count.

Two first-pass counts were thrown out as false positives and are recorded here so
nobody re-derives them: "22 pages emitting undefined" was the legitimate JS keyword
inside highlight spans, and "40 pages leaking comments" was sample HTML inside
fenced blocks.

## Scope

- [x] Build the test harness first (task 00) - never refactor a parser blind
- [x] Multi-line raw HTML blocks pass through untouched (CommonMark type 6)
- [x] HTML comment blocks consumed, never rendered
- [x] Autolinks `<https://...>` render an anchor instead of vanishing
- [x] List items hold block content (fences, paragraphs, nested lists)
- [x] A blank line between items keeps one list, numbering intact
- [x] Task lists render real checkboxes
- [x] Placeholder forgery made impossible (NUL sentinel)
- [x] Attribute escaping on href / src / alt / title
- [x] Pipes inside inline code stay in one table cell
- [x] Backslash escapes honoured
- [ ] Setext headings - SKIPPED, 0 corpus hits, not worth the `---` ambiguity

## Bugs

Each was reproduced first, then fixed, then proven by the named test.

- [x] `html_block` - only the FIRST line of an HTML block passed through raw; the
      rest was markdown-processed and the closing tag swallowed into a `<p>`.
      Measured: 1 page emitted `</div></p>`, 61 files at risk. A `<script>` body
      was markdown-processed and wrapped in a paragraph.
- [x] `html_comment` - `<!-- note -->` fell through to a paragraph and was escaped
      into view. Measured: 8 live pages published the author's notes to readers.
- [x] `autolink` - `<https://tina4.com>` matched the inline-HTML protection rule and
      was emitted as a literal unknown tag. The browser renders nothing, so the URL
      silently disappeared. Measured: 1 page.
- [x] `list_block` - a fence indented under `1.` ended the list; the following item
      opened a second `<ol>` and the numbering restarted at 1. Measured: 4 files.
- [x] `task_list` - `- [ ] item` rendered literal brackets. Measured: 4 pages.
- [x] `placeholder` - the sentinel scheme was INCONSISTENT, which is what made it
      dangerous. Code spans were held as `NUL C n NUL` (real NUL bytes, unforgeable)
      but author HTML, links and images were held as ` H n ` with plain SPACES.
      So `Register C0 holds it` rendered correctly while `Header H0 is the first one`
      rendered as "Headerundefinedis the first one". 0 corpus hits, but a latent
      data-corruption landmine on the half that was unprotected. Both now use one
      NUL-delimited holder, and NUL is stripped from source on entry, so forgery is
      structurally impossible.
- [x] `binary source file` - because those raw NUL bytes were committed,
      `src/markdown.js` was stored as BINARY in git (`file` reports `data`;
      `git diff` reported `Bin 16390 -> 20357 bytes` and never a readable diff).
      The most-changed file in the repo had no reviewable history. The rewrite
      writes the sentinel as the two-character escape `\u0000` instead, so the file
      is plain UTF-8 text again and diffs are readable from here on.
- [x] `attr_escape` - href/src/alt/title were interpolated unescaped.
      `[click](a"onmouseover="alert(1))` produced a clean attribute breakout.
- [x] `table` - a pipe inside inline code split the cell. Row splitting is now
      code-span aware and honours `\|`.
- [x] `backslash` - `\*star\*` rendered as `\<em>star\</em>`: the escape was ignored
      AND the backslash stayed visible.

## Tests

42 tests in [test/markdown.test.js](tina4press/test/markdown.test.js), named for the
defect they lock in, each with a positive and a negative case. No mocks: the parser
is a pure function over a string, so these exercise the real code path end to end.

- [x] `code_is_sacred` x3 - Frond, Handlebars and a raw `<script>` survive a fence
- [x] `autolink` x3, `html_comment` x5, `html_block` x4
- [x] `list_block` x5, `task_list` x3, `placeholder` x3
- [x] `attr_escape` x4, `table` x3, `backslash` x4
- [x] `regress` x5 - links with code labels, adjacent links, headings, unknown
      containers, tabs and code-groups

## Verification

Independently re-run at HEAD, not taken from any agent's summary.

| Check | Result |
|---|---|
| `node --test "test/*.test.js"` | **42 pass, 0 fail** |
| Real corpus build | **271 pages, 982ms** |
| Comments leaked to readers | 8 -> **0** |
| Autolinks swallowed | 1 -> **0** |
| Mis-nested `</div></p>` | 1 -> **0** |
| Literal `[ ]` task boxes | 4 -> **0** |
| Placeholder forgery | 0 -> **0** (now impossible) |
| Checkboxes now rendering | 0 -> **58** |
| Content volume after the HTML-block change | 14,821 `<p>` / 34,057 `<li>` / 7,231 code blocks - no swallowing |

Qualified: verified on macOS (Darwin 25.5.0), Node v24.9.0, against the
tina4-documentation corpus at its current HEAD. Not run on Linux or Windows.

## Commits

- 51f2749  fix(markdown): stop the renderer eating content; 42 regression tests
- afcde30  Merge feature/release0.1.11 -> main, tagged v0.1.11

## Status: Done, shipped in v0.1.11
