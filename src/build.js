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
import { collectPageLinks, checkLinks, reportLinks } from "./links.js";

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
//  clean: directory-style (foo -> foo/index.html) — served natively by EVERY
//  static host (Apache DirectoryIndex, Nginx, Netlify, Vercel, GH Pages, S3),
//  no server config needed. non-clean: foo.html.
function outFileFor(relPath, clean) {
  const n = noExtOf(relPath);
  if (!clean) return n + ".html";
  if (n === "index") return "index.html";
  if (n.endsWith("/index")) return n + ".html";      // dir/index -> dir/index.html
  return n + "/index.html";                            // foo -> foo/index.html
}
// Public URL (clean = directory-style). index -> "", dir/index -> "dir/", foo -> "foo/".
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
//
// A .html link is only rewritten when it actually names a markdown page. Static
// files copied out of public/ are .html too, and rewriting those to a clean URL
// pointed 15 live gallery demos at directories that do not exist: the file is
// gallery/01-dashboard.html, but the link became /gallery/01-dashboard/ -> 404.
// A .md link is always rewritten; if it resolves to nothing the link checker
// reports it rather than the rewrite silently inventing a URL.
function fixContentLink(href, pageDir, clean, base, isPage) {
  const m = href.match(/^([^#]*?)\.(md|html)(#.*)?$/i);
  if (!m) return null;
  let p = m[1]; const ext = m[2].toLowerCase(); const hash = m[3] || "";
  if (/^https?:/i.test(p) || p === "") return null;
  const n = p.startsWith("/") ? posixNormalize(p) : posixNormalize((pageDir ? pageDir + "/" : "") + p);
  if (ext === "html" && isPage && !isPage(n)) return null;
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

export function build(config, { quiet = false, strict = false } = {}) {
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
  // customCss: copied into assets and linked AFTER theme.css, so a site's
  // overrides win by cascade order rather than by specificity guesswork.
  const customCss = [].concat(config.themeConfig.customCss || []).filter(Boolean);
  const customCssFiles = customCss.map((p, k) => {
    const src = resolve(config.dir, p);
    if (!existsSync(src)) {
      console.warn(`tina4press: customCss not found, skipping: ${p}`);
      return null;
    }
    return { src, name: `custom-${k}.css` };
  }).filter(Boolean);
  // nav links cleaned once (config nav uses .html or .md; make them match mode)
  const renderConfig = {
    ...config,
    customCssFiles: customCssFiles.map((f) => f.name),
    themeConfig: {
      ...config.themeConfig,
      nav: (config.themeConfig.nav || []).map((n) => ({ ...n, link: siteLinkFix(n.link, clean) })),
    },
  };

  // 3) render + write each page, collect search records
  rmSync(config.outPath, { recursive: true, force: true });
  mkdirSync(config.outPath, { recursive: true });
  const searchIndex = [];
  const redirects = []; // { from: "/foo.html", to: "/foo/" } for old-link 301s
  const linkPages = []; // { relPath, url, ids, hrefs } for the dead-link check
  // every markdown page by its extensionless path, so a .html link can be told
  // apart from a static file copied out of public/
  const pageKeys = new Set(pages.map((p) => noExtOf(p.relPath)));
  const isPage = (n) => pageKeys.has(n) || pageKeys.has(n + "/index");

  for (const page of pages) {
    const slugger = makeSlugger();
    let { html, toc } = markdownToHtml(page.content, { slugger });
    // rewrite every internal .md/.html link (relative or absolute) to a final URL
    const pageDir = dirname(page.relPath) === "." ? "" : dirname(page.relPath);
    html = html.replace(/href="([^"]+)"/g, (m, href) => {
      const fixed = fixContentLink(href, pageDir, clean, base, isPage);
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
    linkPages.push({ relPath: page.relPath, url: page.url, ...collectPageLinks(out) });

    // clean mode: redirect the old .html ONLY for pages whose file actually
    // moved (foo.html -> foo/index.html). Index pages keep their location
    // (dir/index.html), so /dir/index.html still serves directly — no redirect,
    // which would otherwise fight DirectoryIndex on /dir/.
    if (clean) {
      const oldFile = noExtOf(page.relPath) + ".html";
      if (oldFile !== outFileFor(page.relPath, true)) {
        redirects.push({ from: "/" + oldFile, to: withBase(page.url, base) || "/" });
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
  for (const f of customCssFiles) copyFileSync(f.src, join(assetsDir, f.name));
  writeFileSync(join(assetsDir, "search-index.json"), JSON.stringify(searchIndex));

  // 5) public passthrough
  copyDir(config.publicPath, config.outPath);

  // 6) Always emit a small .htaccess: harmless on non-Apache hosts (ignored),
  // a sane Apache default (no MultiViews content-negotiation surprises), and -
  // crucially for servers that extract over the web root without clearing it -
  // it OVERWRITES any stale .htaccess so old rules never linger. In clean mode
  // it also carries the old-.html -> clean 301s, mirrored to a host-agnostic
  // _redirects (Netlify / Cloudflare Pages).
  writeFileSync(join(config.outPath, ".htaccess"), htaccessBody(base, clean));
  if (clean && redirects.length) {
    writeFileSync(join(config.outPath, "_redirects"),
      redirects.map((r) => `${r.from} ${r.to} 301`).join("\n") + "\n");
  }

  // 7) dead-link check, against what was actually rendered
  const publicFiles = new Set();
  if (existsSync(config.publicPath)) {
    (function walkPublic(dir, prefix = "") {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walkPublic(p, prefix + name + "/");
        else publicFiles.add(prefix + name);
      }
    })(config.publicPath);
  }
  const linkReport = checkLinks(linkPages, { base, assets: publicFiles });
  // `quiet` suppresses OUTPUT, it must never change the verdict — a caller that
  // builds quietly still needs to know the site has broken links.
  const linksClean = !linkReport.brokenLinks.length && !linkReport.deadAnchors.length;
  if (!quiet) reportLinks(linkReport, { strict });

  const ms = Date.now() - t0;
  if (!quiet) console.log(`tina4press: built ${pages.length} page(s) in ${ms}ms -> ${relative(process.cwd(), config.outPath)}`);
  return {
    pages: pages.length, ms,
    brokenLinks: linkReport.brokenLinks, deadAnchors: linkReport.deadAnchors,
    ok: linksClean,
  };
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

// .htaccess: sane Apache defaults, and (clean mode) LOOP-FREE 301s from old
// .html to clean URLs. We match %{THE_REQUEST} - the raw original request line,
// which Apache does NOT rewrite on internal subrequests - so DirectoryIndex
// serving foo/index.html can never re-trigger the rule (that internal-redirect
// loop, AH00124, is what 500'd the earlier mod_alias Redirect version). One
// pattern covers every page, so it stays tiny. Harmless on non-Apache hosts.
function htaccessBody(base, withRedirects) {
  const b = (base || "/").replace(/\/*$/, "/");
  const head = ["# Generated by tina4press.", "Options -MultiViews", "DirectoryIndex index.html"];
  if (!withRedirects) return head.join("\n") + "\n";
  return [
    ...head,
    "RewriteEngine On",
    `RewriteBase ${b}`,
    "# /path/index.html -> /path/",
    "RewriteCond %{THE_REQUEST} \\s/+(.*?)index\\.html[\\s?] [NC]",
    `RewriteRule ^ ${b}%1 [R=301,L]`,
    "# /foo.html -> /foo/  (but never redirect away from a file that exists:",
    "# a static .html copied out of public/ must serve, not 301 into a 404)",
    "RewriteCond %{REQUEST_FILENAME} !-f",
    "RewriteCond %{THE_REQUEST} \\s/+([^?\\s]+?)\\.html[\\s?] [NC]",
    `RewriteRule ^ ${b}%1/ [R=301,L]`,
    "",
  ].join("\n");
}
