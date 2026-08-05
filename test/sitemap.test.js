import { test } from "node:test";
import assert from "node:assert/strict";
import { sitemapXml, robotsTxt, absoluteUrl } from "../src/sitemap.js";

test("sitemap: every page appears exactly once, as an absolute URL", () => {
  const xml = sitemapXml([{ url: "" }, { url: "guide/" }, { url: "api/" }], "https://tina4.com");
  assert.equal((xml.match(/<url>/g) || []).length, 3);
  assert.match(xml, /<loc>https:\/\/tina4\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/tina4\.com\/guide\/<\/loc>/);
});

test("sitemap: a trailing slash on the hostname does not double up", () => {
  assert.match(sitemapXml([{ url: "a/" }], "https://x.com/"), /<loc>https:\/\/x\.com\/a\/<\/loc>/);
});

test("sitemap: XML special characters in a URL are escaped", () => {
  const xml = sitemapXml([{ url: "a?x=1&y=2" }], "https://x.com");
  assert.match(xml, /&amp;/);
  assert.doesNotMatch(xml, /y=2<\/loc>[\s\S]*&(?!amp;)/);
});

test("sitemap: it is well-formed and declares the sitemap namespace", () => {
  const xml = sitemapXml([{ url: "" }], "https://x.com");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  assert.match(xml, /<\/urlset>\n$/);
});

test("sitemap: no lastmod is emitted", () => {
  // A mtime-derived lastmod claims every page changed on the CI checkout date.
  assert.doesNotMatch(sitemapXml([{ url: "a/" }], "https://x.com"), /lastmod/);
});

test("robots: the default allows everything and points at the sitemap", () => {
  const txt = robotsTxt("https://tina4.com");
  assert.match(txt, /User-agent: \*/);
  assert.match(txt, /Allow: \//);
  assert.match(txt, /Sitemap: https:\/\/tina4\.com\/sitemap\.xml/);
});

test("robots: custom rules replace the default wholesale", () => {
  const txt = robotsTxt("https://x.com", "User-agent: *\nDisallow: /private/");
  assert.match(txt, /Disallow: \/private\//);
  assert.doesNotMatch(txt, /Allow: \//);
});

test("robots: without a hostname there is no sitemap line", () => {
  assert.doesNotMatch(robotsTxt(""), /Sitemap:/);
});

test("absoluteUrl: the site root resolves to a bare slash", () => {
  assert.equal(absoluteUrl("https://x.com", ""), "https://x.com/");
});
