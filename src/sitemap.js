// sitemap.js — sitemap.xml and robots.txt.
//
// Both need absolute URLs, so both need config.hostname. Without it a sitemap
// would be invalid, so we say so once and emit nothing rather than shipping a
// file crawlers will reject.
//
// No lastmod. On a CI checkout every file's mtime is the checkout time, so a
// mtime-derived lastmod tells every crawler that all 271 pages changed today —
// worse than no hint at all. Real dates need git, which is a later, opt-in job.

const xmlEscape = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// Join a hostname and a site-relative URL into one absolute URL.
export function absoluteUrl(hostname, url) {
  const host = String(hostname).replace(/\/+$/, "");
  const path = String(url || "").replace(/^\/+/, "");
  return path ? `${host}/${path}` : `${host}/`;
}

/**
 * @param entries [{ url, changefreq?, priority? }] site-relative URLs (base applied)
 * @param hostname "https://example.com"
 */
export function sitemapXml(entries, hostname) {
  const urls = entries.map((e) => {
    const parts = [`    <loc>${xmlEscape(absoluteUrl(hostname, e.url))}</loc>`];
    if (e.changefreq) parts.push(`    <changefreq>${xmlEscape(e.changefreq)}</changefreq>`);
    if (e.priority != null) parts.push(`    <priority>${xmlEscape(e.priority)}</priority>`);
    return `  <url>\n${parts.join("\n")}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/**
 * A permissive default plus the sitemap pointer, which is the only part a
 * crawler cannot guess. `robots` in config replaces the rules wholesale.
 */
export function robotsTxt(hostname, robots) {
  const body = robots
    ? String(robots).trimEnd()
    : "User-agent: *\nAllow: /";
  const sitemap = hostname ? `\n\nSitemap: ${absoluteUrl(hostname, "sitemap.xml")}` : "";
  return body + sitemap + "\n";
}
