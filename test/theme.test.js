// Theme tests: the token contract, the escape hatches, and the accessibility
// floors. The contrast test is the important one — it is the only thing that
// stops a future palette tweak from quietly shipping unreadable text.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderPage } from "../src/theme/layout.js";

const themeCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/theme/theme.css"), "utf8");

const render = (themeConfig, extra = {}) => renderPage({
  contentHtml: "<p>body</p>",
  toc: [],
  page: { title: "T", description: "", relPath: "a.md", url: "a/", layout: "doc", data: {} },
  config: { title: "S", description: "d", base: "/", themeConfig: { nav: [], ...themeConfig }, ...extra },
  sidebar: [],
});

// ---------------------------------------------------------------------------
// Token contract
// ---------------------------------------------------------------------------

test("theme_tokens: a colour override reaches the emitted style block", () => {
  const html = render({ colors: { light: { brand: "#ff0088" }, dark: { brand: "#00ff88" } } });
  assert.match(html, /:root\{[^}]*--tp-brand:#ff0088/);
  assert.match(html, /:root\[data-theme="dark"\]\{[^}]*--tp-brand:#00ff88/);
});

test("theme_tokens: syntax colours are themeable via colors.<mode>.code", () => {
  const html = render({ colors: { light: { code: { keyword: "#123456", string: "#654321" } } } });
  assert.match(html, /--tk-keyword:#123456/);
  assert.match(html, /--tk-string:#654321/);
});

test("theme_tokens: fonts and layout land on :root", () => {
  const html = render({ fonts: { mono: "Fira Code" }, layout: { contentWidth: "800px" } });
  assert.match(html, /--tp-mono:Fira Code/);
  assert.match(html, /--tp-content:800px/);
});

test("theme_tokens: a flat colors object is treated as light", () => {
  assert.match(render({ colors: { brand: "#abcdef" } }), /:root\{[^}]*--tp-brand:#abcdef/);
});

test("theme_tokens: an unknown key is ignored, not injected", () => {
  const html = render({ colors: { light: { bogusKey: "#fff", brand: "#111111" } } });
  assert.match(html, /--tp-brand:#111111/);
  assert.doesNotMatch(html, /bogusKey/);
});

test("theme_tokens: a value cannot break out of the style rule", () => {
  const html = render({ colors: { light: { brand: "red}</style><script>alert(1)</script>" } } });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<\/style><script/);
});

test("theme_tokens: no style block is emitted when nothing is configured", () => {
  assert.doesNotMatch(render({}), /id="tp-colors"/);
});

// ---------------------------------------------------------------------------
// Escape hatches
// ---------------------------------------------------------------------------

test("custom_css: a custom stylesheet is linked AFTER theme.css so it wins", () => {
  const html = render({}, { customCssFiles: ["custom-0.css"] });
  const theme = html.indexOf("assets/theme.css");
  const custom = html.indexOf("assets/custom-0.css");
  assert.ok(custom > -1, "the custom stylesheet must be linked");
  assert.ok(custom > theme, "it must come after theme.css in source order");
});

test("slots: a configured slot renders at its insertion point", () => {
  const html = render({ slots: { headerEnd: '<a class="ver">v3</a>', contentBottom: "<p>after</p>" } });
  assert.match(html, /<a class="ver">v3<\/a>/);
  assert.match(html, /<p>after<\/p>/);
});

test("slots: a slot may be a function of the page", () => {
  const html = render({ slots: { contentTop: (p) => `<b>${p.relPath}</b>` } });
  assert.match(html, /<b>a\.md<\/b>/);
});

test("slots: an unknown slot name is ignored", () => {
  assert.doesNotMatch(render({ slots: { evilSlot: "<x-bad></x-bad>" } }), /x-bad/);
});

// ---------------------------------------------------------------------------
// Accessibility floors
// ---------------------------------------------------------------------------

test("a11y: the theme honours prefers-reduced-motion", () => {
  assert.match(themeCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test("a11y: the theme has print styles", () => {
  assert.match(themeCss, /@media print/);
});

test("a11y: there is a focus-visible ring", () => {
  assert.match(themeCss, /:focus-visible\s*\{[^}]*outline:/);
});

// Contrast. Parses the real token values out of theme.css and checks every
// foreground against the surface it actually sits on, in BOTH themes.
function tokensFor(block) {
  const m = themeCss.match(block);
  assert.ok(m, `could not find the ${block} token block`);
  const out = {};
  for (const [, k, v] of m[1].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) out[k] = v;
  return out;
}
function luminance(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const AA = 4.5;
for (const [mode, re] of [
  ["light", /:root \{([\s\S]*?)\n\}/],
  ["dark", /:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/],
]) {
  test(`contrast: every ${mode} token meets WCAG AA on its own surface`, () => {
    const t = tokensFor(re);
    const bg = t["--tp-bg"], codeBg = t["--tp-code-bg"];
    assert.ok(bg && codeBg, "the palette must define --tp-bg and --tp-code-bg");
    const pairs = [
      ["--tp-fg", bg], ["--tp-fg-2", bg], ["--tp-fg-3", bg],
      ["--tp-brand", bg], ["--tp-brand-2", bg], ["--tp-warning", bg], ["--tp-danger", bg],
      ["--tk-comment", codeBg], ["--tk-string", codeBg], ["--tk-keyword", codeBg],
      ["--tk-number", codeBg], ["--tk-fn", codeBg], ["--tk-key", codeBg], ["--tk-tag", codeBg],
    ];
    const failures = pairs
      .filter(([tok]) => t[tok])
      .map(([tok, on]) => [tok, +contrast(t[tok], on).toFixed(2)])
      .filter(([, r]) => r < AA);
    assert.deepEqual(failures, [], `below AA (${AA}:1): ${JSON.stringify(failures)}`);
  });
}
