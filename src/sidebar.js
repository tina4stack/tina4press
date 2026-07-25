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

// pages: [{ relPath, url, data, content }]. Returns [{ text, link?, items:[] }].
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
