// build.js — the static-site pipeline. Reads markdown, renders each page into
// the tina4-js theme, writes static HTML, and emits assets + a search index.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, copyFileSync, rmSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { markdownToHtml, makeSlugger } from "./markdown.js";
import { parseFrontmatter } from "./frontmatter.js";
import { buildSidebar, titleFromPage } from "./sidebar.js";
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

function urlFor(relPath) {
  // guide/intro.md -> guide/intro.html ; index.md -> index.html (served as dir root)
  return relPath.replace(/\.md$/, ".html").replace(/\\/g, "/");
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
  const files = existsSync(config.srcPath) ? walk(config.srcPath) : [];
  // 1) parse every page
  const pages = files.map((abs) => {
    const raw = readFileSync(abs, "utf8");
    const { data, content } = parseFrontmatter(raw);
    const relPath = relative(config.srcPath, abs).replace(/\\/g, "/");
    return { abs, relPath, data, content, url: urlFor(relPath) };
  });

  // 2) sidebar (once, from all pages)
  const sidebar = buildSidebar(pages, config);

  // 3) render + write each page, collect search records
  rmSync(config.outPath, { recursive: true, force: true });
  mkdirSync(config.outPath, { recursive: true });
  const searchIndex = [];

  for (const page of pages) {
    const slugger = makeSlugger();
    let { html, toc } = markdownToHtml(page.content, { slugger });
    // rewrite internal .md links to .html
    html = html.replace(/href="([^"]+?)\.md(#[^"]*)?"/g, 'href="$1.html$2"');

    const title = titleFromPage(page);
    const pageMeta = {
      title, description: page.data.description || "", relPath: page.relPath,
      url: page.url, layout: page.data.layout || "doc",
    };
    const out = renderPage({ contentHtml: html, toc, page: pageMeta, config, sidebar });
    const dest = join(config.outPath, page.url);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, out);

    if (page.data.layout !== "home") {
      searchIndex.push({
        title, url: withBase(page.url, config.base), crumb: crumbFor(page.relPath),
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
