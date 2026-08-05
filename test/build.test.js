// Build-level tests. These run the real pipeline over a real temp directory —
// no doubles — because the defects they lock in only appear once markdown,
// link rewriting and the public/ passthrough interact.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "../src/build.js";

function site(files, config = {}) {
  const dir = mkdtempSync(join(tmpdir(), "tp-"));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, body);
  }
  const cfg = {
    title: "T", description: "d", base: "/", cleanUrls: true,
    srcDir: "docs", outDir: "dist", themeConfig: { nav: [], search: false },
    ...config,
    dir,
    srcPath: join(dir, "docs"),
    outPath: join(dir, "dist"),
    publicPath: join(dir, "docs", "public"),
  };
  const result = build(cfg, { quiet: true });
  const read = (p) => readFileSync(join(cfg.outPath, p), "utf8");
  return { dir, cfg, result, read, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("build: a .html link to a public passthrough file is left alone", () => {
  // This shipped 15 dead demos on tina4.com. The link was rewritten to the
  // clean URL /gallery/01-dashboard/, but the target is a static FILE at
  // gallery/01-dashboard.html, so every one of them 404'd.
  const s = site({
    "docs/index.md": '# Home\n\n<a href="/gallery/01-dashboard.html">demo</a>\n',
    "docs/public/gallery/01-dashboard.html": "<h1>demo</h1>",
  });
  try {
    const html = s.read("index.html");
    assert.match(html, /href="\/gallery\/01-dashboard\.html"/, "the .html link must survive");
    assert.doesNotMatch(html, /href="\/gallery\/01-dashboard\/"/, "it must not become a clean URL");
    assert.ok(existsSync(join(s.cfg.outPath, "gallery/01-dashboard.html")), "the file is copied out");
    assert.deepEqual(s.result.brokenLinks, [], "and it is not reported as broken");
  } finally { s.cleanup(); }
});

test("build: a .html link that IS a real page is still rewritten to a clean URL", () => {
  const s = site({ "docs/index.md": '# Home\n\n[guide](/guide.html)\n', "docs/guide.md": "# Guide\n" });
  try {
    assert.match(s.read("index.html"), /href="\/guide\/"/);
  } finally { s.cleanup(); }
});

test("build: a .md link is always rewritten", () => {
  const s = site({ "docs/index.md": "# Home\n\n[guide](guide.md)\n", "docs/guide.md": "# Guide\n" });
  try {
    assert.match(s.read("index.html"), /href="\/guide\/"/);
  } finally { s.cleanup(); }
});

test("build: a link to a missing page is reported, not silently shipped", () => {
  const s = site({ "docs/index.md": "# Home\n\n[gone](missing.md)\n" });
  try {
    assert.equal(s.result.brokenLinks.length, 1);
    assert.equal(s.result.ok, false);
  } finally { s.cleanup(); }
});

test("build: a clean site reports ok", () => {
  const s = site({ "docs/index.md": "# Home\n\n[g](guide.md)\n", "docs/guide.md": "# Guide\n" });
  try {
    assert.deepEqual(s.result.brokenLinks, []);
    assert.deepEqual(s.result.deadAnchors, []);
    assert.equal(s.result.ok, true);
  } finally { s.cleanup(); }
});

test("build: the htaccess never redirects away from a file that exists", () => {
  const s = site({ "docs/index.md": "# Home\n" });
  try {
    const ht = s.read(".htaccess");
    // Two rules mention .html; the guard belongs to the /foo.html -> /foo/ one.
    const rule = ht.slice(ht.indexOf("# /foo.html -> /foo/"));
    assert.match(rule, /RewriteCond %\{REQUEST_FILENAME\} !-f/, "the file-exists guard must be present");
    const i = rule.indexOf("RewriteCond %{REQUEST_FILENAME} !-f");
    const j = rule.indexOf("RewriteRule");
    assert.ok(i > -1 && i < j, "and it must precede the RewriteRule it guards");
  } finally { s.cleanup(); }
});

test("build: a pinned heading id survives into the output", () => {
  const s = site({ "docs/index.md": '# H\n\n### Templates <a href="#tpl" id="tpl"></a>\n\n[go](#tpl)\n' });
  try {
    assert.match(s.read("index.html"), /id="tpl"/);
    assert.deepEqual(s.result.deadAnchors, []);
  } finally { s.cleanup(); }
});
