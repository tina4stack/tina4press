// layout.js — assemble the full HTML document for one page. Static, complete
// HTML (works with JS disabled); tina4-js progressively enhances it (theme
// toggle, search, copy, mobile nav). The theme is data-attribute driven so the
// pre-paint inline script can set it before first paint (no flash).

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function navHtml(nav, base) {
  return nav.map((n) => `<a class="tp-nav-link" href="${esc(withBase(n.link, base))}">${esc(n.text)}</a>`).join("");
}

function sidebarHtml(sidebar, currentUrl, base) {
  return sidebar.map((group) => {
    let hasActive = false;
    const items = (group.items || []).map((it) => {
      const isActive = it.link === currentUrl;
      if (isActive) hasActive = true;
      return `<li><a class="tp-side-link${isActive ? " tp-active" : ""}" href="${esc(withBase(it.link, base))}">${esc(it.text)}</a></li>`;
    }).join("");
    // Collapsible group when marked collapsed — but always open if it holds the
    // current page, so the reader never loses their place.
    if (group.collapsed && !hasActive) {
      return `<details class="tp-side-block tp-collapsible"><summary class="tp-side-group">${esc(group.text)}</summary><ul>${items}</ul></details>`;
    }
    if (group.link) {
      return `<div class="tp-side-block"><a class="tp-side-group-link" href="${esc(withBase(group.link, base))}">${esc(group.text)}</a><ul>${items}</ul></div>`;
    }
    const canCollapse = group.collapsed !== undefined;
    return canCollapse
      ? `<details class="tp-side-block tp-collapsible" open><summary class="tp-side-group">${esc(group.text)}</summary><ul>${items}</ul></details>`
      : `<div class="tp-side-block"><p class="tp-side-group">${esc(group.text)}</p><ul>${items}</ul></div>`;
  }).join("");
}

function tocHtml(toc, title = "On this page") {
  if (!toc || toc.length < 2) return "";
  const items = toc.map((h) =>
    `<li class="tp-toc-l${h.level}"><a href="#${esc(h.slug)}">${esc(h.text)}</a></li>`).join("");
  return `<nav class="tp-toc" aria-label="On this page"><p class="tp-toc-title">${esc(title)}</p><ul>${items}</ul></nav>`;
}

function withBase(link, base) {
  if (/^https?:\/\//.test(link) || link.startsWith("#")) return link;
  return (base.replace(/\/$/, "") + "/" + link.replace(/^\//, "")).replace(/\/{2,}/g, "/");
}

// ---------------------------------------------------------------------------
// The theme token contract.
//
// These key names are the PUBLIC API of the theme and are FROZEN: new keys may
// be added, existing ones are never renamed. VitePress renamed --vp-c-brand to
// --vp-c-brand-1 and broke every site's custom.css at once; that must not
// happen here. Anything a site omits falls back to the theme.css default, so a
// one-line override is a valid config.
// ---------------------------------------------------------------------------
const COLOR_VARS = {
  brand: "--tp-brand", brand2: "--tp-brand-2", bg: "--tp-bg", bgSoft: "--tp-bg-soft",
  bgMute: "--tp-bg-mute", border: "--tp-border", border2: "--tp-border-2",
  fg: "--tp-fg", fg2: "--tp-fg-2", fg3: "--tp-fg-3", codeBg: "--tp-code-bg", sel: "--tp-sel",
  // text that sits ON the brand colour. Was hardcoded #fff, which is unreadable
  // the moment a site picks a light brand.
  onBrand: "--tp-on-brand",
  warning: "--tp-warning", danger: "--tp-danger", shadow: "--tp-shadow",
};
// Syntax highlighting, under colors.<mode>.code.*
const CODE_VARS = {
  comment: "--tk-comment", string: "--tk-string", keyword: "--tk-keyword",
  number: "--tk-number", fn: "--tk-fn", key: "--tk-key", tag: "--tk-tag", var: "--tk-var",
};
// Not light/dark specific — these live on :root once.
const FONT_VARS = { body: "--tp-font", mono: "--tp-mono" };
const LAYOUT_VARS = {
  maxWidth: "--tp-max", contentWidth: "--tp-content",
  sidebarWidth: "--tp-sidebar-w", tocWidth: "--tp-toc-w",
};

// A config value is going straight into a <style> block, so strip the
// characters that could close the rule, close the element, or start an import.
// Quotes and commas survive because a font stack needs them.
const cssValue = (v) => String(v).replace(/[<>{};@]/g, "").trim();

function declsFrom(map, obj) {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj)
    .filter(([k]) => map[k])
    .map(([k, v]) => `${map[k]}:${cssValue(v)}`);
}

function colorBlock(selector, colors) {
  if (!colors) return "";
  const decls = [...declsFrom(COLOR_VARS, colors), ...declsFrom(CODE_VARS, colors.code)];
  return decls.length ? `${selector}{${decls.join(";")}}` : "";
}
// Google Analytics (gtag). themeConfig.analytics = 'G-XXXX' or { ga: 'G-XXXX' }.
function analyticsScript(themeConfig) {
  const a = themeConfig.analytics;
  const id = typeof a === "string" ? a : a && a.ga;
  if (!id || !/^[A-Za-z0-9-]+$/.test(id)) return "";
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>` +
    `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}` +
    `gtag('js',new Date());gtag('config','${id}');</script>`;
}

// General head tags, VitePress-compatible format: [tag, attrs, innerHTML?].
// Lets a site port its `head: [...]` array verbatim.
function headHtml(config) {
  const head = config.head;
  if (!Array.isArray(head)) return "";
  return head.map((entry) => {
    if (!Array.isArray(entry)) return "";
    const [tag, attrs = {}, inner = ""] = entry;
    if (!/^[a-zA-Z][\w-]*$/.test(tag)) return "";
    const a = Object.entries(attrs)
      .map(([k, v]) => ` ${k}="${String(v).replace(/"/g, "&quot;")}"`).join("");
    return inner || !/^(link|meta|base)$/i.test(tag) ? `<${tag}${a}>${inner}</${tag}>` : `<${tag}${a}>`;
  }).join("");
}

function colorStyle(themeConfig) {
  const c = themeConfig.colors;
  const root = [
    ...declsFrom(FONT_VARS, themeConfig.fonts),
    ...declsFrom(LAYOUT_VARS, themeConfig.layout),
  ];
  // A flat colors object (no light/dark keys) is treated as light.
  const light = c ? colorBlock(":root", c.light || c) : "";
  const dark = c ? colorBlock(':root[data-theme="dark"]', c.dark) : "";
  const rootBlock = root.length ? `:root{${root.join(";")}}` : "";
  const all = rootBlock + light + dark;
  return all ? `<style id="tp-colors">${all}</style>` : "";
}

// Named layout slots. A slot value is an HTML STRING (or a function returning
// one) — never a component. That is deliberate: VitePress slots needed Vue
// component overrides, which is the dependency tina4press exists to avoid, and
// they broke on upgrade. A string cannot break on upgrade.
const SLOTS = [
  "headerStart", "headerEnd", "sidebarTop", "sidebarBottom",
  "contentTop", "contentBottom", "footer",
];
function slot(themeConfig, name, page) {
  const all = themeConfig.slots;
  if (!all || !SLOTS.includes(name)) return "";
  const v = all[name];
  if (!v) return "";
  return typeof v === "function" ? String(v(page) || "") : String(v);
}

// VitePress-style home hero + features, from frontmatter.
// Clean-aware fix for a hero/site link (mirrors build's siteLinkFix).
function siteLink(link, base, clean) {
  if (/^https?:\/\//.test(link) || String(link).startsWith("#")) return link;
  const m = String(link).match(/^(\/?[^#]*?)(?:\.(md|html))?(#.*)?$/i);
  const n = (m ? m[1] : link).replace(/^\/+/, "").replace(/\/$/, "");
  const hash = (m && m[3]) || "";
  let url;
  if (clean) url = (n === "" || n === "index") ? "" : (n.endsWith("/index") ? n.slice(0, -5) : n + "/");
  else url = (m && m[2]) ? n + ".html" : (n ? n + ".html" : "");
  return withBase(url, base) + hash;
}

function heroHtml(data, base, clean) {
  const h = data.hero || {};
  const actions = Array.isArray(h.actions) ? h.actions : [];
  const btns = actions.map((a) => {
    const link = siteLink(String(a.link || "#"), base, clean);
    const brand = (a.theme || "brand") === "brand";
    return `<a class="tp-hero-btn ${brand ? "tp-hero-brand" : "tp-hero-alt"}" href="${esc(link)}">${esc(a.text || "")}</a>`;
  }).join("");
  const imgSrc = h.image && (h.image.src || typeof h.image === "string") ? withBase(h.image.src || h.image, base) : "";
  // Animated (SVGator) SVGs run their embedded <script> only via <object>, not
  // <img> — matches how the VitePress theme loaded the animated hero logo.
  const img = !imgSrc ? ""
    : /\.svg(\?|$)/i.test(imgSrc)
      ? `<div class="tp-hero-img"><object type="image/svg+xml" data="${esc(imgSrc)}" aria-label="${esc((h.image && h.image.alt) || "")}"></object></div>`
      : `<div class="tp-hero-img"><img src="${esc(imgSrc)}" alt="${esc((h.image && h.image.alt) || "")}"></div>`;
  const feats = Array.isArray(data.features) ? data.features : [];
  const featGrid = feats.length
    ? `<div class="tp-features">${feats.map((f) =>
        `<div class="tp-feature">${f.icon ? `<div class="tp-feature-ic">${esc(f.icon)}</div>` : ""}` +
        `<h3>${esc(f.title || "")}</h3><p>${esc(f.details || f.text || "")}</p></div>`).join("")}</div>`
    : "";
  return `<section class="tp-hero">
    <div class="tp-hero-text">
      ${h.name ? `<h1 class="tp-hero-name">${esc(h.name)}</h1>` : ""}
      ${h.text ? `<p class="tp-hero-tag">${esc(h.text)}</p>` : ""}
      ${h.tagline ? `<p class="tp-hero-line">${esc(h.tagline)}</p>` : ""}
      ${btns ? `<div class="tp-hero-actions">${btns}</div>` : ""}
    </div>
    ${img}
  </section>${featGrid}`;
}

export function renderPage({ contentHtml, toc, page, config, sidebar }) {
  const tc = config.themeConfig;
  const base = config.base || "/";
  const title = page.title ? `${page.title} · ${config.title}` : config.title;
  const asset = (p) => withBase(`assets/${p}`, base);
  // Chrome strings for this page's locale, already merged by configForLocale.
  const m = tc.messages || {};
  const t = (k, fallback) => esc(m[k] || fallback);
  const lang = (config.i18n && config.i18n.lang) || "en";
  const dir = (config.i18n && config.i18n.dir) || "ltr";

  const editLink = tc.editLinkBase
    ? `<a class="tp-edit" href="${esc(tc.editLinkBase.replace(/\/$/, "") + "/" + page.relPath)}" target="_blank" rel="noreferrer">${t("editLink", "Edit this page")}</a>`
    : "";

  // hreflang tells a crawler these pages are translations of each other.
  const alternates = page.alternates || [];
  const hreflang = alternates.filter((a) => a.translated).map((a) =>
    `<link rel="alternate" hreflang="${esc(a.lang)}" href="${esc(withBase(a.url, base))}">`).join("");
  // The switcher never links into a 404: an untranslated locale goes to its home.
  const localeSwitcher = alternates.length > 1
    ? `<div class="tp-locales"><button class="tp-locale-btn" aria-haspopup="true" aria-expanded="false">${
        esc((alternates.find((a) => a.current) || alternates[0]).label)}</button><ul class="tp-locale-menu">${
        alternates.map((a) =>
          `<li><a class="tp-locale-link${a.current ? " tp-on" : ""}" hreflang="${esc(a.lang)}" href="${
            esc(withBase(a.url, base))}">${esc(a.label)}</a></li>`).join("")}</ul></div>`
    : "";

  const isHome = page.layout === "home";
  const homeHero = isHome ? heroHtml(page.data || {}, base, !!config.cleanUrls) : "";

  return `<!doctype html>
<html lang="${esc(lang)}" dir="${esc(dir)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description || config.description)}">
${hreflang}
<link rel="stylesheet" href="${esc(asset("theme.css"))}">
${(config.customCssFiles || []).map((f) => `<link rel="stylesheet" href="${esc(asset(f))}">`).join("")}
${colorStyle(tc)}
${headHtml(config)}
${analyticsScript(tc)}
${tc.logo ? `<link rel="icon" href="${esc(withBase(tc.logo, base))}">` : ""}
<script>(()=>{try{var t=localStorage.getItem('tp-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();</script>
</head>
<body>
<header class="tp-header">
  <div class="tp-header-in">
    <a class="tp-brand" href="${esc(base)}">
      ${tc.logo ? `<img class="tp-logo" src="${esc(withBase(tc.logo, base))}" alt="">` : `<span class="tp-brand-mark">◈</span>`}
      <span class="tp-brand-name">${esc(config.title)}</span>
    </a>
    ${slot(tc, "headerStart", page)}
    <nav class="tp-nav">${navHtml(tc.nav, base)}</nav>
    <div class="tp-header-actions">
      ${localeSwitcher}
      ${slot(tc, "headerEnd", page)}
      ${tc.search ? `<button class="tp-search-btn" id="tp-search-open" aria-label="${t("search","Search")}">🔍 <span class="tp-search-hint">${t("search","Search")}</span><kbd>⌘K</kbd></button>` : ""}
      <button class="tp-theme-toggle" id="tp-theme-toggle" aria-label="${t("toggleTheme","Toggle theme")}"></button>
      <button class="tp-menu-toggle" id="tp-menu-toggle" aria-label="${t("menu","Menu")}">☰</button>
    </div>
  </div>
</header>
<div class="tp-mobile-menu" id="tp-mobile-menu" hidden>
  <nav class="tp-mobile-nav">${navHtml(tc.nav, base)}</nav>
  ${sidebar && sidebar.length ? `<div class="tp-mobile-side">${sidebarHtml(sidebar, page.url, base)}</div>` : ""}
</div>
<div class="tp-body${isHome ? " tp-home" : ""}">
  ${isHome ? "" : `<aside class="tp-sidebar" id="tp-sidebar"><div class="tp-sidebar-in">${slot(tc, "sidebarTop", page)}${sidebarHtml(sidebar, page.url, base)}${slot(tc, "sidebarBottom", page)}</div></aside>`}
  <main class="tp-main">
    ${homeHero}
    ${slot(tc, "contentTop", page)}
    <article class="tp-content${isHome ? " tp-content-home" : ""}">${contentHtml}</article>
    ${slot(tc, "contentBottom", page)}
    ${isHome ? "" : `<div class="tp-page-foot">${editLink}${tc.footer ? `<p class="tp-footer">${tc.footer}</p>` : ""}${slot(tc, "footer", page)}</div>`}
  </main>
  ${isHome ? "" : tocHtml(toc, m.tocTitle)}
</div>
${tc.search ? `<div class="tp-search-modal" id="tp-search-modal" hidden>
  <div class="tp-search-box" role="dialog" aria-label="Search">
    <input id="tp-search-input" type="search" placeholder="${t("searchPlaceholder","Search the docs…")}" autocomplete="off" spellcheck="false">
    <div class="tp-search-results" id="tp-search-results"></div>
    <div class="tp-search-foot"><kbd>↑</kbd><kbd>↓</kbd> ${t("searchNavigate","navigate")} <kbd>↵</kbd> ${t("searchOpen","open")} <kbd>esc</kbd> ${t("searchClose","close")}</div>
  </div>
</div>` : ""}
<script>window.__TP_BASE__=${JSON.stringify(base)};window.__TP_I18N__=${JSON.stringify({messages:m,lang,locale:page.locale||"root"})};${tc.chat ? `window.__TP_CHAT__=${JSON.stringify(tc.chat)};` : ""}</script>
<script src="${esc(asset("tina4js.min.js"))}"></script>
<script src="${esc(asset("client.js"))}"></script>
</body>
</html>`;
}

export { esc };
