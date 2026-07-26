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

function tocHtml(toc) {
  if (!toc || toc.length < 2) return "";
  const items = toc.map((h) =>
    `<li class="tp-toc-l${h.level}"><a href="#${esc(h.slug)}">${esc(h.text)}</a></li>`).join("");
  return `<nav class="tp-toc" aria-label="On this page"><p class="tp-toc-title">On this page</p><ul>${items}</ul></nav>`;
}

function withBase(link, base) {
  if (/^https?:\/\//.test(link) || link.startsWith("#")) return link;
  return (base.replace(/\/$/, "") + "/" + link.replace(/^\//, "")).replace(/\/{2,}/g, "/");
}

// Map friendly config color keys -> CSS variables. Anything the site omits
// falls back to the theme.css defaults, so a site can retheme with one or two
// values (themeConfig.colors.light.brand = '#...').
const COLOR_VARS = {
  brand: "--tp-brand", brand2: "--tp-brand-2", bg: "--tp-bg", bgSoft: "--tp-bg-soft",
  bgMute: "--tp-bg-mute", border: "--tp-border", border2: "--tp-border-2",
  fg: "--tp-fg", fg2: "--tp-fg-2", fg3: "--tp-fg-3", codeBg: "--tp-code-bg", sel: "--tp-sel",
};
function colorBlock(selector, colors) {
  if (!colors) return "";
  const decls = Object.entries(colors)
    .filter(([k]) => COLOR_VARS[k])
    .map(([k, v]) => `${COLOR_VARS[k]}:${String(v).replace(/[<>]/g, "")}`)
    .join(";");
  return decls ? `${selector}{${decls}}` : "";
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
  if (!c) return "";
  const light = colorBlock(":root", c.light || c);   // flat object = light
  const dark = colorBlock(':root[data-theme="dark"]', c.dark);
  return light || dark ? `<style id="tp-colors">${light}${dark}</style>` : "";
}

// VitePress-style home hero + features, from frontmatter.
// Clean-aware fix for a hero/site link (mirrors build's siteLinkFix).
function siteLink(link, base, clean) {
  if (/^https?:\/\//.test(link) || String(link).startsWith("#")) return link;
  const m = String(link).match(/^(\/?[^#]*?)(?:\.(md|html))?(#.*)?$/i);
  const n = (m ? m[1] : link).replace(/^\/+/, "").replace(/\/$/, "");
  const hash = (m && m[3]) || "";
  let url;
  if (clean) url = (n === "" || n === "index") ? "" : (n.endsWith("/index") ? n.slice(0, -5) : n);
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

  const editLink = tc.editLinkBase
    ? `<a class="tp-edit" href="${esc(tc.editLinkBase.replace(/\/$/, "") + "/" + page.relPath)}" target="_blank" rel="noreferrer">Edit this page</a>`
    : "";

  const isHome = page.layout === "home";
  const homeHero = isHome ? heroHtml(page.data || {}, base, !!config.cleanUrls) : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description || config.description)}">
<link rel="stylesheet" href="${esc(asset("theme.css"))}">
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
    <nav class="tp-nav">${navHtml(tc.nav, base)}</nav>
    <div class="tp-header-actions">
      ${tc.search ? `<button class="tp-search-btn" id="tp-search-open" aria-label="Search">🔍 <span class="tp-search-hint">Search</span><kbd>⌘K</kbd></button>` : ""}
      <button class="tp-theme-toggle" id="tp-theme-toggle" aria-label="Toggle theme"></button>
      <button class="tp-menu-toggle" id="tp-menu-toggle" aria-label="Menu">☰</button>
    </div>
  </div>
</header>
<div class="tp-mobile-menu" id="tp-mobile-menu" hidden>
  <nav class="tp-mobile-nav">${navHtml(tc.nav, base)}</nav>
  ${sidebar && sidebar.length ? `<div class="tp-mobile-side">${sidebarHtml(sidebar, page.url, base)}</div>` : ""}
</div>
<div class="tp-body${isHome ? " tp-home" : ""}">
  ${isHome ? "" : `<aside class="tp-sidebar" id="tp-sidebar"><div class="tp-sidebar-in">${sidebarHtml(sidebar, page.url, base)}</div></aside>`}
  <main class="tp-main">
    ${homeHero}
    <article class="tp-content${isHome ? " tp-content-home" : ""}">${contentHtml}</article>
    ${isHome ? "" : `<div class="tp-page-foot">${editLink}${tc.footer ? `<p class="tp-footer">${tc.footer}</p>` : ""}</div>`}
  </main>
  ${isHome ? "" : tocHtml(toc)}
</div>
${tc.search ? `<div class="tp-search-modal" id="tp-search-modal" hidden>
  <div class="tp-search-box" role="dialog" aria-label="Search">
    <input id="tp-search-input" type="search" placeholder="Search the docs…" autocomplete="off" spellcheck="false">
    <div class="tp-search-results" id="tp-search-results"></div>
    <div class="tp-search-foot"><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>↵</kbd> open <kbd>esc</kbd> close</div>
  </div>
</div>` : ""}
<script>window.__TP_BASE__=${JSON.stringify(base)};${tc.chat ? `window.__TP_CHAT__=${JSON.stringify(tc.chat)};` : ""}</script>
<script src="${esc(asset("tina4js.min.js"))}"></script>
<script src="${esc(asset("client.js"))}"></script>
</body>
</html>`;
}

export { esc };
