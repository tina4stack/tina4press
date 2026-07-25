// frontmatter.js — lenient YAML-ish frontmatter parser (zero-dep). Handles the
// flat key: value pairs tina4press cares about (title, description, layout,
// nav order). Nested/complex YAML is preserved as raw text under the key so a
// theme can read it, but we never require a full YAML engine.

export function parseFrontmatter(src) {
  const m = src.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, content: src };
  const body = src.slice(m[0].length);
  const data = {};
  let key = null;
  for (const rawLine of m[1].split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const kv = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (kv && !/^\s/.test(rawLine)) {
      key = kv[1];
      const val = kv[2];
      data[key] = val === "" ? "" : coerce(val);
    } else if (key != null) {
      // continuation / nested lines: keep as raw appended text
      data[key] = (typeof data[key] === "string" ? data[key] + "\n" : "") + line;
    }
  }
  return { data, content: body };
}

function coerce(v) {
  const s = v.trim().replace(/^["']|["']$/g, "");
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === "true";
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}
