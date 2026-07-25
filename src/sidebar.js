// sidebar.js — navigation sidebar. Two modes:
//   1) explicit: config.themeConfig.sidebar (array, or path-keyed object) — used
//      verbatim, resolved per page by longest-prefix (VitePress-compatible).
//   2) auto (default): a SECTION-SCOPED sidebar — a page under /js/ sees only
//      the /js/ chapters, grouped like VitePress via config.themeConfig
//      .sidebarGroups[section] (name-based stems) or numeric ranges, with a
//      Quick Reference link, collapsed non-first groups, and an orphan "More".

import { basename, dirname } from "node:path";

function titleFromPage(page) {
  if (page.data.title && page.data.title !== "home") return String(page.data.title);
  const h1 = page.content.match(/^\s*#\s+(.+)$/m);
  if (h1) return h1[1].replace(/[*_`]/g, "").trim();
  return prettify(basename(page.relPath).replace(/\.md$/, ""));
}
function prettify(name) {
  return name.replace(/^\d+[-_.]?/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function orderKey(page) {
  const m = basename(page.relPath).match(/^(\d+)/);
  if (m) return parseInt(m[1], 10);
  if (typeof page.data.order === "number") return page.data.order;
  return 9999;
}
function stemOf(relPath) {
  return basename(relPath).replace(/^\d+-/, "").replace(/\.md$/, "");
}
export function sectionOf(url) {
  const parts = String(url).replace(/^\//, "").split("/");
  return parts.length > 1 ? parts[0] : "";
}

// Resolve an explicit sidebar (array or path-keyed object) for a page URL.
export function resolveSidebar(sidebar, url) {
  if (Array.isArray(sidebar)) return sidebar;
  if (sidebar && typeof sidebar === "object") {
    const path = "/" + String(url).replace(/^\//, "");
    let best = null, bestLen = -1;
    for (const key of Object.keys(sidebar)) {
      if (path.startsWith(key) && key.length > bestLen) { best = sidebar[key]; bestLen = key.length; }
    }
    return best || [];
  }
  return [];
}

// The section-scoped auto sidebar for a given page.
export function autoSectionSidebar(page, pages, config) {
  const section = sectionOf(page.url);
  if (!section) {
    // root-level pages: a flat list of the other root pages
    const items = pages
      .filter((p) => sectionOf(p.url) === "" && basename(p.relPath) !== "index.md" && p.data.layout !== "home")
      .sort(sortPages)
      .map((p) => ({ text: titleFromPage(p), link: p.url }));
    return items.length ? [{ text: "Overview", items }] : [];
  }

  const inSection = pages.filter((p) => sectionOf(p.url) === section);
  const label = (config.themeConfig.sectionLabels || {})[section] || prettify(section);
  const chapters = inSection
    .filter((p) => basename(p.relPath) !== "index.md")
    .sort(sortPages)
    .map((p) => ({ text: titleFromPage(p), link: p.url, stem: stemOf(p.relPath), num: orderKey(p) }));

  const sidebar = [];
  const indexPage = inSection.find((p) => basename(p.relPath) === "index.md");
  if (indexPage) sidebar.push({ text: `${label} Reference`, items: [{ text: "Overview", link: indexPage.url }] });

  const groups = (config.themeConfig.sidebarGroups || {})[section];
  // Per-section ranges win; otherwise a single global range table applies to
  // every section that isn't explicitly grouped (mirrors VitePress SECTION_RANGES).
  const ranges = (config.themeConfig.sidebarRanges || {})[section]
    || config.themeConfig.sidebarRangesDefault;

  if (groups && chapters.length) {
    const seen = new Set();
    groups.forEach((g, i) => {
      const items = chapters.filter((c) => g.stems.includes(c.stem));
      items.forEach((c) => seen.add(c.stem));
      if (items.length) sidebar.push({ text: g.text, collapsed: i !== 0, items: items.map(strip) });
    });
    const orphans = chapters.filter((c) => !seen.has(c.stem)).map(strip);
    if (orphans.length) sidebar.push({ text: "More", collapsed: true, items: orphans });
  } else if (ranges && chapters.length) {
    for (const [name, [start, end]] of Object.entries(ranges)) {
      const items = chapters.filter((c) => c.num >= start && c.num <= end).map(strip);
      if (items.length) sidebar.push({ text: name, collapsed: name !== Object.keys(ranges)[0], items });
    }
  } else if (chapters.length) {
    sidebar.push({ text: label, items: chapters.map(strip) });
  }
  return sidebar;
}

function strip(c) { return { text: c.text, link: c.link }; }
function sortPages(a, b) { return orderKey(a) - orderKey(b) || titleFromPage(a).localeCompare(titleFromPage(b)); }

export { titleFromPage };
