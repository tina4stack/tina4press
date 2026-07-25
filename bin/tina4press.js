#!/usr/bin/env node
// tina4press CLI — `tina4press build [dir]` and `tina4press dev [dir] [--port N]`.

import { loadConfig } from "../src/config.js";
import { build } from "../src/build.js";
import { dev } from "../src/dev.js";

const [, , cmd = "build", ...rest] = process.argv;
const siteDir = rest.find((a) => !a.startsWith("-")) || ".";
const portArg = rest.find((a) => a.startsWith("--port="));
const port = portArg ? parseInt(portArg.split("=")[1], 10) : 5180;

const cfg = await loadConfig(siteDir);

if (cmd === "build") {
  build(cfg);
} else if (cmd === "dev") {
  dev(cfg, port);
} else {
  console.log(`tina4press — a zero-Vue static site generator on tina4-js

Usage:
  tina4press build [dir]            Build the site in <dir> (default: .)
  tina4press dev   [dir] [--port=N] Serve with live reload (default port 5180)

Config: optional <dir>/tina4press.config.js (title, themeConfig.nav, sidebar, base…)
Content: markdown in <dir>/docs (override with srcDir). Static files in <dir>/docs/public.`);
  process.exit(cmd === "help" || cmd === "--help" ? 0 : 1);
}
