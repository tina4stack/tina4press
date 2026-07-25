// dev.js — a tiny dev server: build once, serve the output, watch the source,
// rebuild on change, and live-reload the browser over Server-Sent Events. No
// external dependencies.

import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, watch } from "node:fs";
import { join, extname } from "node:path";
import { build } from "./build.js";

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".ico": "image/x-icon", ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain",
};

const RELOAD_SNIPPET =
  `<script>new EventSource('/__tp_reload').onmessage=()=>location.reload();</script>`;

export function dev(config, port = 5180) {
  build(config);
  const clients = new Set();

  let debounce = null;
  const rebuild = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      try { build(config, { quiet: true }); console.log("tina4press: rebuilt"); }
      catch (e) { console.error("tina4press build error:", e.message); }
      for (const res of clients) res.write("data: reload\n\n");
    }, 80);
  };
  // Watch only the source content — never the output dir, or each build's
  // writes would retrigger a build in an endless loop.
  if (existsSync(config.srcPath)) watch(config.srcPath, { recursive: true }, rebuild);

  const server = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/__tp_reload") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write("retry: 500\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    let file = join(config.outPath, url);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      // try .html for extensionless routes
      if (existsSync(file + ".html")) file += ".html";
      else { res.writeHead(404, { "Content-Type": "text/html" }); res.end("<h1>404</h1>" + RELOAD_SNIPPET); return; }
    }
    const ext = extname(file);
    let body = readFileSync(file);
    if (ext === ".html") body = body.toString().replace("</body>", RELOAD_SNIPPET + "</body>");
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(body);
  });
  server.listen(port, () => {
    console.log(`tina4press dev: http://localhost:${port}  (watching ${config.srcDir}/)`);
  });
  return server;
}
