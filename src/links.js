// links.js — dead-link checking.
//
// build() rewrites every internal .md/.html link to a final URL and, until now,
// never checked the target existed. A docs site rots quietly: tina4.com was
// shipping 16 links to pages that do not exist and 126 anchors to headings that
// do not exist, and nothing ever said so.
//
// The check runs against what was actually rendered, so it sees the same URLs a
// reader's browser will request.

// Only the document body is navigation. <head> carries generated asset links
// (theme.css, the favicon) which are emitted by the build, not authored, and
// hrefs inside code are examples — every `<a href="...">` in a tutorial would
// otherwise be a false positive.
function proseOf(html) {
  const body = html.indexOf("<body");
  return (body === -1 ? html : html.slice(body))
    .replace(/<pre[\s\S]*?<\/pre>/g, " ")
    .replace(/<code[\s\S]*?<\/code>/g, " ");
}

export function collectPageLinks(html) {
  const ids = new Set();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  const hrefs = [];
  for (const m of proseOf(html).matchAll(/\shref="([^"]+)"/g)) hrefs.push(m[1]);
  return { ids, hrefs };
}

const EXTERNAL = /^(https?:|mailto:|tel:|data:|javascript:|#)/i;

// Normalise a final URL to the key used in the page index: no base, no
// extension, no trailing slash, no leading slash, and a directory index folded
// onto its directory. "" is the site root, so "/" and "index.html" agree.
function keyOf(url, base) {
  let p = url.split("#")[0].split("?")[0];
  const b = (base || "/").replace(/\/+$/, "");
  if (b && (p === b || p.startsWith(b + "/"))) p = p.slice(b.length);
  p = p.replace(/^\/+/, "").replace(/\.html$/, "").replace(/\/+$/, "");
  if (p === "index") return "";
  return p.replace(/\/index$/, "");
}

/**
 * @param pages [{ relPath, url, ids:Set, hrefs:[] }]  as rendered
 * @param opts  { base, assets:Set<string> } extra paths that exist (public files)
 * @returns { brokenLinks:[], deadAnchors:[] }
 */
export function checkLinks(pages, { base = "/", assets = new Set() } = {}) {
  const byKey = new Map();
  for (const p of pages) byKey.set(keyOf(p.url, "/"), p);

  const brokenLinks = [];
  const deadAnchors = [];

  for (const page of pages) {
    for (const href of page.hrefs) {
      if (EXTERNAL.test(href)) {
        // same-page anchor
        if (href.startsWith("#")) {
          const frag = decodeURIComponent(href.slice(1));
          if (frag && !page.ids.has(frag)) deadAnchors.push({ from: page.relPath, href });
        }
        continue;
      }
      const [, hash] = href.split("#");
      const key = keyOf(href, base);
      const target = byKey.get(key);
      if (!target) {
        // a real file in public/ (an image, a download) is a valid target
        const raw = href.split("#")[0].split("?")[0].replace(/^\/+/, "");
        if (assets.has(raw) || assets.has(keyOf(href, base))) continue;
        brokenLinks.push({ from: page.relPath, href });
        continue;
      }
      if (hash) {
        const frag = decodeURIComponent(hash);
        if (!target.ids.has(frag)) deadAnchors.push({ from: page.relPath, href, to: target.relPath });
      }
    }
  }
  return { brokenLinks, deadAnchors };
}

// Print a report. Returns true when the site is clean.
export function reportLinks({ brokenLinks, deadAnchors }, { strict = false } = {}) {
  const show = (label, rows) => {
    if (!rows.length) return;
    console.warn(`\ntina4press: ${rows.length} ${label}`);
    for (const r of rows.slice(0, 40)) console.warn(`  ${r.from}  ->  ${r.href}`);
    if (rows.length > 40) console.warn(`  ... and ${rows.length - 40} more`);
  };
  show("broken internal link(s)", brokenLinks);
  show("dead anchor(s)", deadAnchors);
  const clean = !brokenLinks.length && !deadAnchors.length;
  if (!clean && strict) {
    console.error("\ntina4press: --strict, failing the build.");
  }
  return clean;
}
