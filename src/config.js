// config.js — load a site's tina4press.config.js (optional) and fill defaults.
// Kept deliberately small: a site needs almost nothing to start.

import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const DEFAULTS = {
  title: "Tina4press",
  description: "Docs built with tina4press",
  base: "/",
  cleanUrls: false,   // true => /foo/ (dir index) + redirect stubs from /foo.html
  srcDir: "docs",
  outDir: "dist",
  themeConfig: {
    nav: [],          // [{ text, link }]
    sidebar: null,    // null => auto from folders; or { '/guide/': [...] }
    footer: "",
    logo: "",         // path served from public/
    editLinkBase: "", // e.g. https://github.com/org/repo/edit/main/docs/
    search: true,
  },
};

export async function loadConfig(siteDir) {
  const dir = resolve(siteDir);
  let user = {};
  for (const name of ["tina4press.config.js", "tina4press.config.mjs"]) {
    const p = join(dir, name);
    if (existsSync(p)) {
      const mod = await import(pathToFileURL(p).href + `?t=${Date.now()}`);
      user = mod.default || mod.config || mod;
      break;
    }
  }
  const cfg = {
    ...DEFAULTS,
    ...user,
    themeConfig: { ...DEFAULTS.themeConfig, ...(user.themeConfig || {}) },
  };
  cfg.dir = dir;
  cfg.srcPath = resolve(dir, cfg.srcDir);
  cfg.outPath = resolve(dir, cfg.outDir);
  cfg.publicPath = resolve(cfg.srcPath, "public");
  return cfg;
}
