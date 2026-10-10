// Tagging / retrieval-metadata tests (#119). The REAL pipeline over a real temp
// directory - no doubles. A page's `tags` (or its synonym `keywords`) and
// `summary` frontmatter must reach both the rendered <meta name="keywords"> and
// the search index, so a broad or synonym query can find the right page even
// when its body text does not carry the words. This is the data mechanism;
// there is deliberately no visible "related" widget yet.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "../src/build.js";

function site(files, config = {}) {
  const dir = mkdtempSync(join(tmpdir(), "tp-tags-"));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, body);
  }
  const cfg = {
    title: "Tina4", description: "One framework, four languages.",
    base: "/", cleanUrls: false,
    srcDir: "docs", outDir: "dist", themeConfig: { nav: [], search: false },
    ...config,
    dir,
    srcPath: join(dir, "docs"),
    outPath: join(dir, "dist"),
    publicPath: join(dir, "docs", "public"),
  };
  build(cfg, { quiet: true });
  const read = (p) => readFileSync(join(cfg.outPath, p), "utf8");
  const index = () => JSON.parse(read("assets/search-index.json"));
  return { read, index, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const keywordsMeta = (html) => {
  const m = html.match(/<meta name="keywords" content="([^"]*)">/);
  return m ? m[1] : null;
};

test("tags: a page's tags + summary reach the keywords meta AND the search index", () => {
  const s = site({
    "docs/about.md":
      "---\ntitle: What is Tina4\nsummary: A zero-dependency web framework in four languages.\n" +
      "tags:\n  - overview\n  - what-is\n  - getting started\n---\n# About\nIt does things.\n",
  });
  const html = s.read("about.html");
  assert.equal(keywordsMeta(html), "overview, what-is, getting started",
    "tags must be emitted as a keywords meta");

  const rec = s.index().find((r) => r.url.includes("about"));
  assert.ok(rec, "the page is indexed");
  assert.equal(rec.summary, "A zero-dependency web framework in four languages.");
  assert.deepEqual(rec.tags, ["overview", "what-is", "getting started"]);
  s.cleanup();
});

test("tags: `keywords` is an accepted synonym, as a comma-separated scalar too", () => {
  const s = site({
    "docs/page.md": "---\ntitle: P\nkeywords: alpha, beta , gamma\n---\n# P\n",
  });
  assert.equal(keywordsMeta(s.read("page.html")), "alpha, beta, gamma");
  assert.deepEqual(s.index().find((r) => r.url.includes("page")).tags, ["alpha", "beta", "gamma"]);
  s.cleanup();
});

test("tags: a page with no tags emits no keywords meta and indexes an empty tag list", () => {
  const s = site({ "docs/plain.md": "---\ntitle: Plain\n---\n# Plain\n" });
  assert.equal(keywordsMeta(s.read("plain.html")), null, "no tags -> no keywords meta");
  assert.deepEqual(s.index().find((r) => r.url.includes("plain")).tags, []);
  s.cleanup();
});
