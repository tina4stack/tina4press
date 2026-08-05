// Link integrity: the anchor rules a docs corpus actually depends on, and the
// checker that stops rot shipping silently.
//
// Every case here was a real defect measured on tina4.com: 15 broken links and
// 119 dead anchors were shipping, and nothing reported them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "../src/markdown.js";
import { collectPageLinks, checkLinks } from "../src/links.js";

const idsOf = (md) => [...markdownToHtml(md).html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);

// ---------------------------------------------------------------------------
// Heading anchors
// ---------------------------------------------------------------------------

test("anchor: an author-pinned id in an empty anchor element wins", () => {
  // The prose and the id deliberately disagree — that is the whole point.
  assert.deepEqual(
    idsOf('### Template Rendering <a href="#templates" id="templates"></a>'),
    ["templates"]
  );
});

test("anchor: a pinned id is not overwritten by the text slug", () => {
  const html = markdownToHtml('### Sessions <a href="#session-handling" id="session-handling"></a>').html;
  assert.match(html, /id="session-handling"/);
  assert.doesNotMatch(html, /id="sessions"/);
});

test("anchor: VitePress {#custom-id} syntax is honoured", () => {
  assert.deepEqual(idsOf("### Localization (i18n) {#localization}"), ["localization"]);
});

test("anchor: {#custom-id} is stripped from the visible heading text", () => {
  assert.doesNotMatch(markdownToHtml("## Title {#pinned}").html, /\{#pinned\}/);
});

test("anchor: a slug starting with a digit gets the VitePress underscore", () => {
  assert.deepEqual(idsOf("## 6. Relationships"), ["_6-relationships"]);
});

test("anchor: a non-numeric slug is left alone", () => {
  assert.deepEqual(idsOf("## Relationships"), ["relationships"]);
});

test("anchor: an ordinary heading still slugs from its text", () => {
  assert.deepEqual(idsOf("## The Section Name"), ["the-section-name"]);
});

test("anchor: duplicate headings still de-duplicate", () => {
  assert.deepEqual(idsOf("## Setup\n\n## Setup"), ["setup", "setup-1"]);
});

// ---------------------------------------------------------------------------
// Container labels
// ---------------------------------------------------------------------------

test("container_label: a label renders inline markdown, not literal characters", () => {
  const html = markdownToHtml("::: tip Use `npm i` first\nbody\n:::").html;
  assert.match(html, /<code>npm i<\/code>/);
});

test("container_label: an html sample in a label is escaped, not made a live link", () => {
  const html = markdownToHtml('::: tip Navigate with `<a href="#page">`\nbody\n:::').html;
  assert.doesNotMatch(html, /<a href="#page">/);
  assert.match(html, /&lt;a href=/);
});

// ---------------------------------------------------------------------------
// The checker
// ---------------------------------------------------------------------------

const page = (relPath, url, html) => ({ relPath, url, ...collectPageLinks(`<body>${html}</body>`) });

test("checker: a link to a page that does not exist is reported", () => {
  const r = checkLinks([page("a.md", "a/", '<a href="/nope/">x</a>')]);
  assert.equal(r.brokenLinks.length, 1);
  assert.equal(r.brokenLinks[0].href, "/nope/");
});

test("checker: a link to a real page is not reported", () => {
  const r = checkLinks([page("a.md", "a/", '<a href="/b/">x</a>'), page("b.md", "b/", "")]);
  assert.deepEqual(r.brokenLinks, []);
});

test("checker: the site root resolves to the index page", () => {
  const r = checkLinks([page("index.md", "index.html", '<a href="/">home</a>')]);
  assert.deepEqual(r.brokenLinks, []);
});

test("checker: a dead #anchor on another page is reported", () => {
  const r = checkLinks([
    page("a.md", "a/", '<a href="/b/#gone">x</a>'),
    page("b.md", "b/", '<h2 id="here">h</h2>'),
  ]);
  assert.equal(r.deadAnchors.length, 1);
});

test("checker: a live #anchor is not reported", () => {
  const r = checkLinks([
    page("a.md", "a/", '<a href="/b/#here">x</a>'),
    page("b.md", "b/", '<h2 id="here">h</h2>'),
  ]);
  assert.deepEqual(r.deadAnchors, []);
});

test("checker: a same-page anchor is resolved against its own ids", () => {
  const ok = checkLinks([page("a.md", "a/", '<h2 id="x">h</h2><a href="#x">go</a>')]);
  assert.deepEqual(ok.deadAnchors, []);
  const bad = checkLinks([page("a.md", "a/", '<a href="#missing">go</a>')]);
  assert.equal(bad.deadAnchors.length, 1);
});

test("checker: external links and mailto are ignored", () => {
  const r = checkLinks([page("a.md", "a/", '<a href="https://x.com/y">e</a><a href="mailto:a@b.c">m</a>')]);
  assert.deepEqual(r.brokenLinks, []);
});

test("checker: an href inside a code sample is not a link", () => {
  const r = checkLinks([page("a.md", "a/", '<pre><code>&lt;a href="/nope/"&gt;</code></pre>')]);
  assert.deepEqual(r.brokenLinks, []);
});

test("checker: generated assets in <head> are not content links", () => {
  const p = { relPath: "a.md", url: "a/",
    ...collectPageLinks('<head><link href="/assets/theme.css"></head><body><p>hi</p></body>') };
  assert.deepEqual(checkLinks([p]).brokenLinks, []);
});

test("checker: a file copied out of public/ counts as a real target", () => {
  const r = checkLinks([page("a.md", "a/", '<a href="/gallery/01-dashboard.html">demo</a>')],
    { assets: new Set(["gallery/01-dashboard.html"]) });
  assert.deepEqual(r.brokenLinks, []);
});
