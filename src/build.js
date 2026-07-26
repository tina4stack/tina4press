// build.js — the static-site pipeline. Reads markdown, renders each page into
// the tina4-js theme, writes static HTML, and emits assets + a search index.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, copyFileSync, rmSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { markdownToHtml, makeSlugger } from "./markdown.js";
import { parseFrontmatter } from "./frontmatter.js";
import { autoSectionSidebar, resolveSidebar, titleFromPage } from "./sidebar.js";
import { renderPage } from "./theme/layout.js";

const require = createRequire(import.meta.url);
const themeDir = dirname(fileURLToPath(import.meta.url)) + "/theme";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "public" || name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

function noExtOf(relPath) { return relPath.replace(/\.md$/, "").replace(/\\/g, "/"); }

// Public URL for a page. Clean mode: index -> "", dir/index -> "dir/", foo -> "foo/".
function pageUrl(relPath, clean) {
  const n = noExtOf(relPath);
  return clean ? cleanFromNoExt(n) : n + ".html";
}
// Where the page file is written on disk.
function outFileFor(relPath, clean) {
  const n = noExtOf(relPath);
  if (!clean) return n + ".html";
  if (n === "index") return "index.html";
  if (n.endsWith("/index")) return n + ".html";
  return n + "/index.html";
}
function cleanFromNoExt(n) {
  if (n === "index" || n === "") return "";
  if (n.endsWith("/index")) return n.slice(0, -"index".length); // "dir/index" -> "dir/"
  return n + "/";
}
function posixNormalize(p) {
  const out = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
}
// Rewrite one internal doc link (relative or absolute .md/.html) to a final URL.
// Returns null for external links / anchors / non-doc hrefs (leave untouched).
function fixContentLink(href, pageDir, clean, base) {
  const m = href.match(/^([^#]*?)\.(md|html)(#.*)?$/i);
  if (!m) return null;
  let p = m[1]; const hash = m[3] || "";
  if (/^https?:/i.test(p) || p === "") return null;
  const n = p.startsWith("/") ? posixNormalize(p) : posixNormalize((pageDir ? pageDir + "/" : "") + p);
  return withBase(clean ? cleanFromNoExt(n) : n + ".html", base) + hash;
}
function crumbFor(relPath) {
  const parts = relPath.split(/[\\/]/).slice(0, -1);
  return parts.map((p) => p.replace(/^\d+[-_.]?/, "").replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())).join(" › ");
}
function plainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")     // drop code blocks from the index body
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function copyDir(src, dst) {
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name), d = join(dst, name);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

export function build(config, { quiet = false } = {}) {
  const t0 = Date.now();
  const clean = !!config.cleanUrls;
  const base = config.base || "/";
  const files = existsSync(config.srcPath) ? walk(config.srcPath) : [];
  // 1) parse every page
  const pages = files.map((abs) => {
    const raw = readFileSync(abs, "utf8");
    const { data, content } = parseFrontmatter(raw);
    const relPath = relative(config.srcPath, abs).replace(/\\/g, "/");
    return { abs, relPath, data, content, url: pageUrl(relPath, clean) };
  });

  // 2) sidebar: explicit config wins; otherwise a section-scoped auto sidebar
  const explicit = config.themeConfig.sidebar;
  // nav links cleaned once (config nav uses .html or .md; make them match mode)
  const renderConfig = {
    ...config,
    themeConfig: {
      ...config.themeConfig,
      nav: (config.themeConfig.nav || []).map((n) => ({ ...n, link: siteLinkFix(n.link, clean) })),
    },
  };

  // 3) render + write each page, collect search records
  rmSync(config.outPath, { recursive: true, force: true });
  mkdirSync(config.outPath, { recursive: true });
  const searchIndex = [];

  for (const page of pages) {
    const slugger = makeSlugger();
    let { html, toc } = markdownToHtml(page.content, { slugger });
    // rewrite every internal .md/.html link (relative or absolute) to a final URL
    const pageDir = dirname(page.relPath) === "." ? "" : dirname(page.relPath);
    html = html.replace(/href="([^"]+)"/g, (m, href) => {
      const fixed = fixContentLink(href, pageDir, clean, base);
      return fixed ? `href="${fixed}"` : m;
    });

    const title = titleFromPage(page);
    const pageMeta = {
      title, description: page.data.description || "", relPath: page.relPath,
      url: page.url, layout: page.data.layout || "doc", data: page.data,
    };
    const rawSidebar = explicit
      ? resolveSidebar(explicit, page.url)
      : autoSectionSidebar(page, pages, config);
    const pageSidebar = normalizeSidebar(rawSidebar, clean);
    const out = renderPage({ contentHtml: html, toc, page: pageMeta, config: renderConfig, sidebar: pageSidebar });
    const dest = join(config.outPath, outFileFor(page.relPath, clean));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, out);

    // clean mode: leave a redirect stub at the old .html path so inbound links live on
    if (clean) {
      const oldHtml = noExtOf(page.relPath) + ".html";
      if (oldHtml !== outFileFor(page.relPath, true)) {
        const target = withBase(page.url, base);
        const rd = join(config.outPath, oldHtml);
        mkdirSync(dirname(rd), { recursive: true });
        writeFileSync(rd, redirectHtml(target));
      }
    }

    if (page.data.layout !== "home") {
      searchIndex.push({
        title, url: withBase(page.url, base), crumb: crumbFor(page.relPath),
        headings: toc.map((h) => h.text),
        text: plainText(page.content).slice(0, 2000),
      });
    }
  }

  // 4) assets
  const assetsDir = join(config.outPath, "assets");
  mkdirSync(assetsDir, { recursive: true });
  const tina4jsDist = dirname(require.resolve("tina4js")); // .../tina4js/dist
  copyFileSync(join(tina4jsDist, "tina4js.min.js"), join(assetsDir, "tina4js.min.js"));
  copyFileSync(join(themeDir, "theme.css"), join(assetsDir, "theme.css"));
  copyFileSync(join(themeDir, "client.js"), join(assetsDir, "client.js"));
  writeFileSync(join(assetsDir, "search-index.json"), JSON.stringify(searchIndex));

  // 5) public passthrough
  copyDir(config.publicPath, config.outPath);

  const ms = Date.now() - t0;
  if (!quiet) console.log(`tina4press: built ${pages.length} page(s) in ${ms}ms -> ${relative(process.cwd(), config.outPath)}`);
  return { pages: pages.length, ms };
}

function withBase(link, base) {
  if (/^https?:\/\//.test(link)) return link;
  return ((base || "/").replace(/\/$/, "") + "/" + link.replace(/^\//, "")).replace(/\/{2,}/g, "/");
}

// Fix a nav/sidebar config link (absolute, no per-page resolution) for the
// active URL mode. Handles .md/.html and already-clean links either way.
function siteLinkFix(link, clean) {
  if (!link || /^https?:\/\//.test(link) || link.startsWith("#")) return link;
  const m = link.match(/^(\/?[^#]*?)(?:\.(md|html))?(#.*)?$/i);
  const raw = (m ? m[1] : link).replace(/^\/+/, "");
  const hasExt = m && m[2];
  const hash = (m && m[3]) || "";
  const n = raw.replace(/\/$/, "");
  if (clean) return cleanFromNoExt(n) + hash;
  // non-clean: ensure a .html target
  if (hasExt) return n + ".html" + hash;
  return (n.endsWith("/") || n === "" ? n : n + ".html") + hash;
}

function normalizeSidebar(sidebar, clean) {
  const fix = (link) => siteLinkFix(link, clean);
  return (sidebar || []).map((g) => ({
    text: g.text, link: g.link ? fix(g.link) : undefined, collapsed: g.collapsed,
    items: (g.items || []).map((it) => ({ ...it, link: fix(it.link) })),
  }));
}

function redirectHtml(target) {
  const t = String(target).replace(/[<>"]/g, "");
  return `<!doctype html><html><head><meta charset="utf-8">` +
    `<link rel="canonical" href="${t}"><meta http-equiv="refresh" content="0; url=${t}">` +
    `<script>location.replace(${JSON.stringify(target)})</script><title>Redirecting</title>` +
    `</head><body>Redirecting to <a href="${t}">${t}</a></body></html>`;
}
