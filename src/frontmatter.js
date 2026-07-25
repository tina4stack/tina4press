// frontmatter.js — parse the leading `--- ... ---` block. A compact,
// indentation-based YAML *subset* (zero-dep): scalars, nested maps, and
// sequences (of scalars or maps). Enough for VitePress-style hero/features
// frontmatter without pulling a full YAML engine.

export function parseFrontmatter(src) {
  const m = src.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, content: src };
  const data = parseYaml(m[1]);
  return { data, content: src.slice(m[0].length) };
}

// Tokenize into { indent, raw } lines, dropping blanks and comments.
function parseYaml(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
    .filter((l) => l.trim() !== "" && !/^\s*#/.test(l))
    .map((l) => ({ indent: l.match(/^ */)[0].length, raw: l.trim(), full: l }));
  const [val] = parseBlock(lines, 0, 0);
  return val && typeof val === "object" ? val : {};
}

// Parse a block at a given indent starting at index i. Returns [value, nextI].
function parseBlock(lines, i, indent) {
  // Sequence?
  if (i < lines.length && lines[i].indent === indent && lines[i].raw.startsWith("- ")) {
    const arr = [];
    while (i < lines.length && lines[i].indent === indent && lines[i].raw.startsWith("-")) {
      const rest = lines[i].raw.slice(1).trim();
      if (rest === "") {
        // item is a nested block on following deeper lines
        const [v, ni] = parseBlock(lines, i + 1, indentOf(lines, i + 1));
        arr.push(v); i = ni;
      } else if (/^[\w.-]+:\s*/.test(rest)) {
        // inline "- key: value" starts a map for this item; treat the rest of
        // the item's deeper lines as part of that map.
        const itemIndent = lines[i].full.indexOf(rest);
        lines[i] = { indent: itemIndent, raw: rest, full: lines[i].full };
        const [v, ni] = parseBlock(lines, i, itemIndent);
        arr.push(v); i = ni;
      } else {
        arr.push(scalar(rest)); i++;
      }
    }
    return [arr, i];
  }

  // Map
  const obj = {};
  let sawKey = false;
  while (i < lines.length && lines[i].indent === indent) {
    const kv = lines[i].raw.match(/^([\w.-]+):\s*(.*)$/);
    if (!kv) break;
    sawKey = true;
    const key = kv[1];
    const inline = kv[2];
    if (inline !== "") { obj[key] = scalar(inline); i++; }
    else {
      const childIndent = indentOf(lines, i + 1);
      if (childIndent > indent) { const [v, ni] = parseBlock(lines, i + 1, childIndent); obj[key] = v; i = ni; }
      else { obj[key] = ""; i++; }
    }
  }
  return [sawKey ? obj : "", i];
}

function indentOf(lines, i) { return i < lines.length ? lines[i].indent : -1; }

function scalar(v) {
  const s = v.trim().replace(/^["']|["']$/g, "");
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === "true";
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}
