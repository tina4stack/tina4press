import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "../src/build.js";
import { localeOf, logicalPath, configForLocale, alternatesFor, dirOf, DEFAULT_MESSAGES } from "../src/i18n.js";

const LOCALES = {
  root: { label: "English", lang: "en" },
  fr: { label: "Français", lang: "fr", title: "Docs FR",
        themeConfig: { messages: { tocTitle: "Sur cette page", tip: "Astuce" } } },
  ar: { label: "العربية", lang: "ar" },
};

// ---------------------------------------------------------------------------
// Locale resolution
// ---------------------------------------------------------------------------

test("i18n: a path's locale comes from its first segment", () => {
  assert.equal(localeOf("guide/routing.md", LOCALES), "root");
  assert.equal(localeOf("fr/guide/routing.md", LOCALES), "fr");
  assert.equal(localeOf("ar/index.md", LOCALES), "ar");
});

test("i18n: a segment that is not a locale stays root", () => {
  assert.equal(localeOf("french/guide.md", LOCALES), "root");
});

test("i18n: translations share a logical path", () => {
  assert.equal(logicalPath("guide/routing.md", LOCALES), "guide/routing");
  assert.equal(logicalPath("fr/guide/routing.md", LOCALES), "guide/routing");
});

test("i18n: RTL is derived from the language subtag", () => {
  assert.equal(dirOf("ar"), "rtl");
  assert.equal(dirOf("he-IL"), "rtl");
  assert.equal(dirOf("fr"), "ltr");
});

test("i18n: a locale overrides title and messages, inheriting the rest", () => {
  const cfg = configForLocale(
    { title: "Docs", description: "d", locales: LOCALES, themeConfig: { nav: [1] } }, "fr");
  assert.equal(cfg.title, "Docs FR");
  assert.equal(cfg.description, "d", "not overridden, so inherited");
  assert.equal(cfg.i18n.lang, "fr");
  assert.equal(cfg.themeConfig.messages.tocTitle, "Sur cette page");
  assert.equal(cfg.themeConfig.messages.editLink, DEFAULT_MESSAGES.editLink, "untranslated keys fall back");
});

test("i18n: an untranslated page falls back to that locale's home, never a 404", () => {
  const pages = [
    { relPath: "guide/routing.md", url: "guide/routing/" },
    { relPath: "fr/guide/routing.md", url: "fr/guide/routing/" },
    { relPath: "ar/index.md", url: "ar/" },
  ];
  const alts = alternatesFor(pages[0], pages, { locales: LOCALES });
  const ar = alts.find((a) => a.locale === "ar");
  assert.equal(ar.translated, false);
  assert.equal(ar.url, "ar/");
  assert.equal(alts.find((a) => a.locale === "fr").url, "fr/guide/routing/");
  assert.equal(alts.find((a) => a.locale === "root").current, true);
});

// ---------------------------------------------------------------------------
// End to end
// ---------------------------------------------------------------------------

function i18nSite() {
  const dir = mkdtempSync(join(tmpdir(), "tp-i18n-"));
  const files = {
    "docs/index.md": "# Home\n\n::: tip\nen\n:::\n",
    "docs/guide/routing.md": "# Routing\n\n## One\n\nx\n\n## Two\n\ny\n",
    "docs/fr/index.md": "# Accueil\n\n::: tip\nfr\n:::\n",
    "docs/fr/guide/routing.md": "# Routage\n\n## Un\n\nx\n\n## Deux\n\ny\n",
    "docs/ar/index.md": "# الرئيسية\n",
  };
  for (const [rel, body] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, body);
  }
  const cfg = {
    title: "Docs", description: "d", base: "/", cleanUrls: true,
    hostname: "https://example.com", locales: LOCALES,
    srcDir: "docs", outDir: "dist", themeConfig: { nav: [], search: true },
    dir, srcPath: join(dir, "docs"), outPath: join(dir, "dist"), publicPath: join(dir, "docs", "public"),
  };
  const result = build(cfg, { quiet: true });
  return { result, read: (p) => readFileSync(join(cfg.outPath, p), "utf8"),
           cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("i18n: each locale gets its own lang and dir on <html>", () => {
  const s = i18nSite();
  try {
    assert.match(s.read("index.html"), /<html lang="en" dir="ltr">/);
    assert.match(s.read("fr/index.html"), /<html lang="fr" dir="ltr">/);
    assert.match(s.read("ar/index.html"), /<html lang="ar" dir="rtl">/);
  } finally { s.cleanup(); }
});

test("i18n: hreflang links translations, and only real ones", () => {
  const s = i18nSite();
  try {
    const html = s.read("guide/routing/index.html");
    assert.match(html, /<link rel="alternate" hreflang="en" href="\/guide\/routing\/">/);
    assert.match(html, /<link rel="alternate" hreflang="fr" href="\/fr\/guide\/routing\/">/);
    assert.doesNotMatch(html, /<link rel="alternate" hreflang="ar"/, "ar has no translation of this page");
  } finally { s.cleanup(); }
});

test("i18n: container labels follow the page locale", () => {
  const s = i18nSite();
  try {
    assert.match(s.read("fr/index.html"), /tp-callout-title">Astuce/);
    assert.match(s.read("index.html"), /tp-callout-title">Tip/);
  } finally { s.cleanup(); }
});

test("i18n: chrome strings follow the page locale", () => {
  const s = i18nSite();
  try {
    assert.match(s.read("fr/guide/routing/index.html"), /tp-toc-title">Sur cette page/);
    assert.match(s.read("guide/routing/index.html"), /tp-toc-title">On this page/);
  } finally { s.cleanup(); }
});

test("i18n: the switcher offers every locale and marks the current one", () => {
  const s = i18nSite();
  try {
    const html = s.read("fr/guide/routing/index.html");
    assert.match(html, /tp-locale-link tp-on"[^>]*hreflang="fr"/);
    assert.match(html, /hreflang="ar" href="\/ar\/"/, "untranslated locale points at its home");
  } finally { s.cleanup(); }
});

test("i18n: the search index records a locale per page", () => {
  const s = i18nSite();
  try {
    const idx = JSON.parse(s.read("assets/search-index.json"));
    assert.deepEqual([...new Set(idx.map((r) => r.locale))].sort(), ["ar", "fr", "root"]);
  } finally { s.cleanup(); }
});

test("i18n: the sitemap covers every locale", () => {
  const s = i18nSite();
  try {
    const xml = s.read("sitemap.xml");
    assert.equal((xml.match(/<loc>/g) || []).length, 5);
    assert.match(xml, /https:\/\/example\.com\/fr\/guide\/routing\//);
  } finally { s.cleanup(); }
});

test("i18n: a single-locale site is unaffected", () => {
  const s = i18nSite();
  s.cleanup();
  // no `locales` key at all -> no switcher, no hreflang, default lang
  const dir = mkdtempSync(join(tmpdir(), "tp-mono-"));
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs/index.md"), "# Home\n\n::: tip\nx\n:::\n");
  const cfg = { title: "D", description: "d", base: "/", cleanUrls: false,
    srcDir: "docs", outDir: "dist", themeConfig: { nav: [] },
    dir, srcPath: join(dir, "docs"), outPath: join(dir, "dist"), publicPath: join(dir, "docs", "public") };
  build(cfg, { quiet: true });
  const html = readFileSync(join(dir, "dist/index.html"), "utf8");
  try {
    assert.match(html, /<html lang="en" dir="ltr">/);
    assert.doesNotMatch(html, /tp-locale-link/);
    assert.doesNotMatch(html, /rel="alternate"/);
    assert.match(html, /tp-callout-title">Tip/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
