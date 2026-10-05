// Open Graph / Twitter Card tests. Like the other build tests these run the
// REAL pipeline over a real temp directory - no doubles - and assert on the
// actual bytes written to disk, because the behaviour that matters (per-page
// og:url, absolute image URLs, the no-hostname fallbacks) only emerges once the
// whole build runs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "../src/build.js";

function site(files, config = {}) {
  const dir = mkdtempSync(join(tmpdir(), "tp-og-"));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, body);
  }
  const cfg = {
    title: "Tina4", description: "One framework, four languages.",
    base: "/", cleanUrls: true,
    srcDir: "docs", outDir: "dist", themeConfig: { nav: [], search: false },
    ...config,
    dir,
    srcPath: join(dir, "docs"),
    outPath: join(dir, "dist"),
    publicPath: join(dir, "docs", "public"),
  };
  build(cfg, { quiet: true });
  const read = (p) => readFileSync(join(cfg.outPath, p), "utf8");
  return { read, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const content = (attr, key, html) => {
  const m = html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`));
  return m ? m[1] : null;
};
const ogContent = (k, html) => content("property", k, html);
const twContent = (k, html) => content("name", k, html);

test("og: with a hostname and a site image, every tag is present and the image is absolute", () => {
  const s = site(
    { "docs/index.md": "---\nlayout: home\n---\n# Home\n" },
    { hostname: "https://tina4.com", ogImage: "/og-image.png", ogImageAlt: "The Tina4 robot",
      ogImageWidth: "1200", ogImageHeight: "630" },
  );
  const html = s.read("index.html");
  assert.equal(ogContent("og:type", html), "website");
  assert.equal(ogContent("og:site_name", html), "Tina4");
  assert.equal(ogContent("og:image", html), "https://tina4.com/og-image.png");
  assert.equal(ogContent("og:image:width", html), "1200");
  assert.equal(ogContent("og:image:height", html), "630");
  assert.equal(ogContent("og:image:alt", html), "The Tina4 robot");
  assert.equal(twContent("twitter:card", html), "summary_large_image");
  assert.equal(twContent("twitter:image", html), "https://tina4.com/og-image.png");
  s.cleanup();
});

test("og: the home page's og:url and canonical resolve to the site root", () => {
  const s = site(
    { "docs/index.md": "---\nlayout: home\n---\n# Home\n" },
    { hostname: "https://tina4.com", ogImage: "/og-image.png" },
  );
  const html = s.read("index.html");
  assert.equal(ogContent("og:url", html), "https://tina4.com/");
  assert.match(html, /<link rel="canonical" href="https:\/\/tina4\.com\/">/);
  s.cleanup();
});

test("og: every page carries its OWN og:url - not one flattened site-wide URL", () => {
  const s = site(
    {
      "docs/index.md": "---\nlayout: home\n---\n# Home\n",
      "docs/ruby.md": "# Tina4 Ruby\n",
      "docs/php.md": "# Tina4 PHP\n",
    },
    { hostname: "https://tina4.com", ogImage: "/og-image.png" },
  );
  const ruby = s.read("ruby/index.html");
  const php = s.read("php/index.html");
  assert.equal(ogContent("og:url", ruby), "https://tina4.com/ruby/");
  assert.equal(ogContent("og:url", php), "https://tina4.com/php/");
  assert.notEqual(ogContent("og:url", ruby), ogContent("og:url", php));
  // A content page defaults to og:type=article; the home page is website.
  assert.equal(ogContent("og:type", ruby), "article");
  // The image is the shared site default on both.
  assert.equal(ogContent("og:image", ruby), "https://tina4.com/og-image.png");
  assert.equal(ogContent("og:image", php), "https://tina4.com/og-image.png");
  s.cleanup();
});

test("og: og:title is the page's own title and does not repeat the site name", () => {
  const s = site(
    { "docs/ruby.md": "# Tina4 Ruby\n" },
    { hostname: "https://tina4.com", ogImage: "/og-image.png" },
  );
  const html = s.read("ruby/index.html");
  // <title> keeps the "page · site" form; og:title is just the page title.
  assert.match(html, /<title>Tina4 Ruby · Tina4<\/title>/);
  assert.equal(ogContent("og:title", html), "Tina4 Ruby");
  assert.equal(ogContent("og:site_name", html), "Tina4");
  s.cleanup();
});

test("og: frontmatter overrides title, description, image, type and alt per page", () => {
  const s = site(
    {
      "docs/launch.md":
        "---\n" +
        "title: Launch\n" +
        "ogTitle: Tina4 - the no framework, framework\n" +
        "ogDescription: Ship in four languages.\n" +
        "ogImage: /special.png\n" +
        "ogImageAlt: Launch banner\n" +
        "ogType: article\n" +
        "---\n# Launch\n",
    },
    { hostname: "https://tina4.com", ogImage: "/og-image.png", ogImageAlt: "default alt" },
  );
  const html = s.read("launch/index.html");
  assert.equal(ogContent("og:title", html), "Tina4 - the no framework, framework");
  assert.equal(ogContent("og:description", html), "Ship in four languages.");
  assert.equal(ogContent("og:image", html), "https://tina4.com/special.png");
  assert.equal(ogContent("og:image:alt", html), "Launch banner");
  assert.equal(ogContent("og:type", html), "article");
  s.cleanup();
});

test("og: without a hostname there is no og:url, no canonical, and a RELATIVE image is dropped", () => {
  const s = site(
    { "docs/index.md": "---\nlayout: home\n---\n# Home\n" },
    { ogImage: "/og-image.png" }, // relative, but no hostname to make it absolute
  );
  const html = s.read("index.html");
  assert.equal(ogContent("og:url", html), null);
  assert.doesNotMatch(html, /rel="canonical"/);
  // A relative image cannot be made absolute without an origin, so it is omitted
  // rather than emitted as a broken relative og:image (scrapers need absolute).
  assert.equal(ogContent("og:image", html), null);
  // With no image, the card downgrades from the large-image variant.
  assert.equal(twContent("twitter:card", html), "summary");
  // Title and description still work - they need no origin. The page's own
  // title (its "# Home" heading) is used, not the site name.
  assert.equal(ogContent("og:title", html), "Home");
  s.cleanup();
});

test("og: a full https:// image is emitted even without a hostname", () => {
  const s = site(
    { "docs/index.md": "---\nlayout: home\n---\n# Home\n" },
    { ogImage: "https://cdn.example.com/card.png" },
  );
  const html = s.read("index.html");
  assert.equal(ogContent("og:image", html), "https://cdn.example.com/card.png");
  assert.equal(twContent("twitter:card", html), "summary_large_image");
  // Still no og:url/canonical, because those need the site's own origin.
  assert.equal(ogContent("og:url", html), null);
  s.cleanup();
});
