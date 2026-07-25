// sidebar.js — build the navigation sidebar automatically from the file tree,
// unless the site config supplies its own. Folders become groups; files become
// links. Order follows a numeric filename prefix (01-intro.md), then a
// frontmatter `order`, then title. `index.md` becomes the group's landing link.

import { basename, dirname } from "node:path";

function titleFromPage(page) {
  if (page.data.title) return String(page.data.title);
  const h1 = page.content.match(/^\s*#\s+(.+)$/m);
  if (h1) return h1[1].replace(/[*_`]/g, "").trim();
  return prettify(basename(page.relPath).replace(/\.md$/, ""));
}

function prettify(name) {
  return name.replace(/^\d+[-_.]?/, "").replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function orderKey(page) {
  const m = basename(page.relPath).match(/^(\d+)/);
  if (m) return parseInt(m[1], 10);
  if (typeof page.data.order === "number") return page.data.order;
  return 9999;
}

// Resolve the sidebar for a specific page URL. Supports VitePress shapes:
//  - an array (one global sidebar)
//  - a path-keyed object { '/js/': [...], '/php/': [...] } chosen by the
//    longest key that prefixes the current page (so porting a VitePress
//    multi-sidebar is copy-paste).
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

// pages: [{ relPath, url, data, content }]. Returns an array sidebar, OR the
// path-keyed object from config (resolved per page by resolveSidebar).
export function buildSidebar(pages, config) {
  if (config.themeConfig.sidebar) return config.themeConfig.sidebar;

  const groups = new Map(); // groupName -> items[]
  const rootItems = [];

  for (const page of pages) {
    if (page.data.layout === "home") continue;
    const dir = dirname(page.relPath);
    const item = { text: titleFromPage(page), link: page.url, _order: orderKey(page), _name: basename(page.relPath) };
    if (dir === "." || dir === "") {
      if (item._name === "index.md") continue; // home / root index isn't a sidebar row
      rootItems.push(item);
    } else {
      const group = dir.split("/")[0];
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(item);
    }
  }

  const sort = (a, b) => a._order - b._order || a.text.localeCompare(b.text);
  const sidebar = [];
  if (rootItems.length) sidebar.push({ text: "Overview", items: rootItems.sort(sort) });
  for (const [name, items] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    sidebar.push({ text: prettify(name), items: items.sort(sort) });
  }
  return sidebar;
}

export { titleFromPage };
