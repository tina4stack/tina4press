// markdown.js — a compact, dependency-free Markdown -> HTML renderer for
// tina4press. Its defining rule: CODE IS SACRED. Fenced blocks and inline code
// are extracted and placeholder-protected before any inline rule runs, and
// their contents are only HTML-escaped — never scanned for template syntax.
// So Frond `{% live %}`, Handlebars `{{ user.name }}`, JSX, or raw <script> in
// a code block render verbatim. There is no template engine on the content, so
// even prose braces are safe. This is the VitePress pain point, designed out.

import { highlight } from "./highlight.js";

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Escape a value interpolated into an HTML attribute. By the time links are
// built the surrounding text has already been through escapeHtml, so the quote
// is the only character still live — and it is the one that would otherwise
// break out of the attribute.
const escAttr = (s) => String(s).replace(/"/g, "&quot;");

// slug generator with de-duplication for heading anchors.
//
// A slug that would start with a digit gets an underscore, matching VitePress.
// Numbered headings ("## 6. Relationships") are everywhere in these docs, and
// without this every cross-reference written against VitePress ("#_6-relationships")
// lands on nothing.
function makeSlugger() {
  const seen = new Map();
  return (text) => {
    let base = text
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "section";
    if (/^\d/.test(base)) base = "_" + base;
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

// ---------------------------------------------------------------------------
// Inline rendering. Every span that must survive untouched is swapped for a
// NUL-delimited placeholder before any other rule runs, then restored last.
//
// NUL is stripped from the source on entry, so prose can never forge a
// placeholder. The previous scheme used ` C0 ` / ` H0 `, which a sentence
// containing that shape could counterfeit: "Header H0 is the first one"
// rendered as "Headerundefinedis the first one".
// ---------------------------------------------------------------------------
const HOLD = "\u0000";
const RESTORE = /\u0000(\d+)\u0000/g;

function renderInline(text) {
  const parts = [];
  const hold = (html) => `${HOLD}${parts.push(html) - 1}${HOLD}`;

  // Inline code, ahead of everything else. The inner class excludes backticks,
  // so this is LINEAR — no catastrophic backtracking on lines with many spans.
  text = text.replace(/(`+)([^`]+?)\1/g, (_, ticks, body) => hold(`<code>${escapeHtml(body.trim())}</code>`));

  // Comments are for the author, not the reader.
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Autolinks <https://…>, before the generic HTML rule below can mistake one
  // for an unknown tag and emit it verbatim — which renders as nothing at all.
  text = text.replace(/<((?:https?|mailto):[^>\s]+)>/g, (_, url) =>
    hold(`<a href="${escAttr(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>`));

  // Author-written inline HTML (explicit heading anchors, <br>, <kbd>).
  text = text.replace(/<\/?[a-zA-Z][^<>]*>/g, (m) => hold(m));

  // Escape what remains so stray < > & are inert.
  text = escapeHtml(text);

  // Backslash escapes, held so the emphasis rules below cannot see the
  // character the author wrote them to hide.
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, (_, ch) => hold(escapeHtml(ch)));

  // images  ![alt](src "title"). The built tag is held so the emphasis rules
  // never rewrite an underscore or asterisk inside the src.
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_, alt, src, title) =>
      hold(`<img src="${escAttr(src)}" alt="${escAttr(alt)}"${title ? ` title="${escAttr(title)}"` : ""} loading="lazy">`));
  // links  [text](href). Hold the <a> open and close tags for the same reason,
  // but leave the LABEL as text so its own **bold**/_italic_ still renders.
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_, label, href, title) => {
      const ext = /^https?:\/\//.test(href);
      const attrs = ext ? ' target="_blank" rel="noreferrer"' : "";
      return hold(`<a href="${escAttr(href)}"${title ? ` title="${escAttr(title)}"` : ""}${attrs}>`) +
        label + hold("</a>");
    });
  // bold, italic, strikethrough
  text = text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");

  return text.replace(RESTORE, (_, i) => parts[+i]);
}

const CONTAINERS = {
  tip: "Tip", info: "Info", note: "Note",
  warning: "Warning", danger: "Danger", details: "Details",
};

// Parse a fenced-code info string, e.g.
//   js{1,3-5} title="app.js" desc="Handles the login form"
function parseFence(info) {
  const lang = (info.match(/^[\w+-]*/) || [""])[0];
  const title = (info.match(/title="([^"]*)"/) || [])[1] || "";
  const desc = (info.match(/desc(?:ription)?="([^"]*)"/) || [])[1] || "";
  const hl = new Set();
  const braces = info.match(/\{([\d,\s-]+)\}/);
  if (braces) {
    for (const part of braces[1].split(",")) {
      const [a, b] = part.split("-").map((x) => parseInt(x.trim(), 10));
      if (b) for (let i = a; i <= b; i++) hl.add(i);
      else if (a) hl.add(a);
    }
  }
  return { lang, title, desc, hl };
}

const indentOf = (line) => line.match(/^(\s*)/)[1].length;

// ---------------------------------------------------------------------------
// Block rendering. Returns { html, toc } where toc is [{level, text, slug}].
// ---------------------------------------------------------------------------
// `labels` lets a locale rename the built-in container titles (Tip, Warning...).
export function markdownToHtml(src, { slugger = makeSlugger(), labels = CONTAINERS } = {}) {
  // Strip NUL so the inline placeholders above cannot be forged from source.
  const lines = src.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  const toc = [];
  let i = 0;

  const flushPara = (buf) => {
    if (buf.length) out.push(`<p>${renderInline(buf.join(" ").trim())}</p>`);
    buf.length = 0;
  };

  while (i < lines.length) {
    let line = lines[i];

    // fenced code — consumed verbatim, never interpreted
    const fence = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (fence) {
      const marker = fence[2][0];
      const { lang, title, desc, hl } = parseFence(fence[3].trim());
      const body = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${marker}{3,}\\s*$`).test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      out.push(renderCodeBlock(body, lang, title, hl, desc));
      continue;
    }

    // custom container  ::: tip [title]   (any name; unknown => generic group,
    // e.g. VitePress `::: code-group`). Matching ANY name is what stops an
    // unknown container from falling through and looping the parser.
    const cont = line.match(/^:::\s*([\w-]+)(.*)$/);
    if (cont) {
      const kind = cont[1];
      const inner = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) { inner.push(lines[i]); i++; }
      i++; // closing :::
      if (kind === "code-group") {
        out.push(renderCodeGroup(inner));
      } else if (kind === "tabs") {
        out.push(renderTabs(inner, slugger, labels));
      } else if (kind === "cards" || kind === "card-grid") {
        out.push(renderCards(inner, slugger, labels));
      } else if (kind === "steps") {
        out.push(`<div class="tp-steps">${markdownToHtml(inner.join("\n"), { slugger, labels }).html}</div>`);
      } else if (kind === "details") {
        // Labels go through renderInline, like tab and card titles do. Escaping
        // them left `code` and **bold** as literal characters in a summary, and
        // an escaped `<a href="...">` sample inside a title read as a real link.
        const label = cont[2].trim() || labels.details || CONTAINERS.details;
        const rendered = markdownToHtml(inner.join("\n"), { slugger, labels }).html;
        out.push(`<details class="tp-details"><summary>${renderInline(label)}</summary>${rendered}</details>`);
      } else if (CONTAINERS[kind]) {
        const label = cont[2].trim() || labels[kind] || CONTAINERS[kind];
        const rendered = markdownToHtml(inner.join("\n"), { slugger, labels }).html;
        out.push(`<div class="tp-callout tp-${kind}"><p class="tp-callout-title">${renderInline(label)}</p>${rendered}</div>`);
      } else {
        const rendered = markdownToHtml(inner.join("\n"), { slugger, labels }).html;
        out.push(`<div class="tp-group tp-${escapeHtml(kind)}">${rendered}</div>`);
      }
      continue;
    }
    // a stray closing ::: with no opener — consume it so it can't stall.
    if (/^:::\s*$/.test(line)) { i++; continue; }

    // HTML comment block — consumed, never rendered. An author's note to
    // themselves used to fall through to a paragraph and get escaped into view.
    if (/^\s*<!--/.test(line)) {
      while (i < lines.length && !/-->/.test(lines[i])) i++;
      i++; // the line carrying -->
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      const level = h[1].length;
      // An author can pin the anchor, either VitePress-style `{#custom-id}` or
      // with an empty anchor element (### Title <a href="#x" id="x"></a>).
      // That id is HONOURED — generating a slug from the heading text instead
      // silently broke every cross-reference written against it, because the
      // pinned id rarely matches the prose ("Template Rendering" -> #templates).
      let raw = h[2];
      const curly = raw.match(/\{#([\w-]+)\}\s*$/);
      if (curly) raw = raw.slice(0, curly.index);
      const anchored = raw.match(/<a\s+[^>]*\bid="([^"]+)"[^>]*>\s*<\/a>/i);
      // The empty anchor itself is redundant once we carry its id, so drop it.
      const text = raw.replace(/<a\s+[^>]*>\s*<\/a>/gi, "").trim();
      const pinned = (curly && curly[1]) || (anchored && anchored[1]);
      const slug = pinned || slugger(text);
      if (level >= 2 && level <= 3) toc.push({ level, text: text.replace(/[*_`]/g, ""), slug });
      out.push(
        `<h${level} id="${slug}">${renderInline(text)}` +
        `<a class="tp-anchor" href="#${slug}" aria-label="Permalink">#</a></h${level}>`
      );
      i++;
      continue;
    }

    // horizontal rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    // blockquote
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${markdownToHtml(buf.join("\n"), { slugger, labels }).html}</blockquote>`);
      continue;
    }

    // table (header row + delimiter row)
    if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const rows = [];
      const headers = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => {
        const l = c.startsWith(":"), r = c.endsWith(":");
        return r && l ? "center" : r ? "right" : l ? "left" : "";
      });
      i += 2;
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) {
        rows.push(splitRow(lines[i])); i++;
      }
      out.push(renderTable(headers, aligns, rows));
      continue;
    }

    // lists (unordered / ordered)
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const { html, next } = renderList(lines, i, slugger, labels);
      out.push(html);
      i = next;
      continue;
    }

    // raw HTML block — every line through to the next blank line passes through
    // untouched (CommonMark type 6). Only the FIRST line used to, so a
    // multi-line <div> or <script> had its body markdown-processed and its
    // closing tag swallowed into a <p>.
    if (/^\s*<(\/?[a-zA-Z][\w-]*)(\s|>|\/)/.test(line)) {
      const buf = [];
      while (i < lines.length && lines[i].trim() !== "") { buf.push(lines[i]); i++; }
      out.push(buf.join("\n"));
      continue;
    }

    // blank line
    if (line.trim() === "") { i++; continue; }

    // paragraph (gather until blank or a block starter)
    const para = [];
    while (
      i < lines.length && lines[i].trim() !== "" &&
      !/^\s*(#{1,6}\s|>|:::|`{3,}|~{3,}|<!--|([-*+]|\d+\.)\s)/.test(lines[i]) &&
      !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])
    ) {
      para.push(lines[i]); i++;
    }
    // Guaranteed progress: if the paragraph gathered nothing (a line that every
    // block rule declined AND the paragraph loop excluded), emit it raw and
    // advance. This makes an infinite loop structurally impossible.
    if (para.length === 0) { out.push(renderInline(lines[i])); i++; }
    else flushPara(para);
  }

  return { html: out.join("\n"), toc };
}

// Split a container's inner lines into labelled sections at `== Label` lines.
function splitSections(innerLines) {
  const sections = [];
  let cur = null;
  for (const line of innerLines) {
    const m = line.match(/^==\s+(.*)$/);
    if (m) { cur = { label: m[1].trim(), lines: [] }; sections.push(cur); }
    else if (cur) cur.lines.push(line);
  }
  return sections;
}

// Built-in content tabs: ::: tabs with `== Label` sections (any content).
function renderTabs(innerLines, slugger, labels) {
  const sections = splitSections(innerLines);
  if (!sections.length) return `<div class="tp-group">${markdownToHtml(innerLines.join("\n"), { slugger, labels }).html}</div>`;
  const nav = sections.map((s, k) =>
    `<button class="tp-tab${k === 0 ? " tp-on" : ""}">${renderInline(s.label)}</button>`).join("");
  const panes = sections.map((s, k) =>
    `<div class="tp-tab-pane${k === 0 ? " tp-on" : ""}">${markdownToHtml(s.lines.join("\n"), { slugger, labels }).html}</div>`).join("");
  return `<div class="tp-tabs"><div class="tp-tabs-nav">${nav}</div>${panes}</div>`;
}

// Built-in card grid: ::: cards with `== Title` sections (title may lead with an emoji).
function renderCards(innerLines, slugger, labels) {
  const sections = splitSections(innerLines);
  if (!sections.length) return "";
  const cards = sections.map((s) => {
    const em = s.label.match(/^(\p{Emoji}|\S)\s+(.*)$/u);
    const icon = em && /\p{Emoji}/u.test(em[1]) ? `<div class="tp-card-ic">${em[1]}</div>` : "";
    const title = icon ? em[2] : s.label;
    return `<div class="tp-card">${icon}<h3>${renderInline(title)}</h3>` +
      `<div class="tp-card-body">${markdownToHtml(s.lines.join("\n"), { slugger, labels }).html}</div></div>`;
  }).join("");
  return `<div class="tp-cards">${cards}</div>`;
}

// Parse the inner lines of a ::: code-group into tabbed code blocks. Tab label
// is each block's title, else its language.
function renderCodeGroup(innerLines) {
  const blocks = [];
  let i = 0;
  while (i < innerLines.length) {
    const f = innerLines[i].match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (!f) { i++; continue; }
    const marker = f[2][0];
    const { lang, title, hl } = parseFence(f[3].trim());
    const body = [];
    i++;
    while (i < innerLines.length && !new RegExp(`^\\s*${marker}{3,}\\s*$`).test(innerLines[i])) { body.push(innerLines[i]); i++; }
    i++;
    blocks.push({ lang, title, hl, body });
  }
  if (!blocks.length) return "";
  const tabs = blocks.map((b, k) =>
    `<button class="tp-cg-tab${k === 0 ? " tp-on" : ""}">${escapeHtml(b.title || b.lang || "code")}</button>`).join("");
  const panes = blocks.map((b, k) => {
    const html = renderCodeBlock(b.body, b.lang, "", b.hl);
    return html.replace('class="tp-code"', `class="tp-code${k === 0 ? " tp-on" : ""}"`);
  }).join("");
  return `<div class="tp-code-group"><div class="tp-cg-tabs">${tabs}</div>${panes}</div>`;
}

function renderCodeBlock(bodyLines, lang, title, hl, desc = "") {
  const rows = bodyLines.map((raw, idx) => {
    const n = idx + 1;
    const code = highlight(raw, lang); // returns HTML-escaped, tokenized spans
    const cls = hl.has(n) ? ' class="tp-hl"' : "";
    return `<span class="tp-line"${cls}>${code || "​"}</span>`;
  }).join("");  // NO newline join: .tp-line is display:block, so a "\n" here
                // would render a SECOND blank line per row inside <pre>.
  const langLabel = lang ? `<span class="tp-lang">${escapeHtml(lang)}</span>` : "";
  const titleBar = (title || desc)
    ? `<div class="tp-code-title">${title ? `<span class="tp-code-file">${escapeHtml(title)}</span>` : ""}` +
      `${desc ? `<span class="tp-code-desc">${escapeHtml(desc)}</span>` : ""}</div>`
    : "";
  const clip = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  const check = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  return (
    `<div class="tp-code" data-lang="${escapeHtml(lang)}">` +
    titleBar +
    `<button class="tp-copy" aria-label="Copy code" data-clip='${clip}' data-check='${check}'>${clip}</button>` +
    langLabel +
    `<pre><code>${rows}</code></pre></div>`
  );
}

// Split one table row on unescaped pipes that sit outside a code span. A pipe
// inside `code` used to split the cell, which mangles any row documenting a
// CLI alternation or a regex.
function splitRow(row) {
  const cells = [];
  let cur = "", tick = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === "\\" && i + 1 < row.length) { cur += c + row[++i]; continue; }
    if (c === "`") tick = !tick;
    if (c === "|" && !tick) { cells.push(cur); cur = ""; continue; }
    cur += c;
  }
  cells.push(cur);
  if (cells.length && cells[0].trim() === "") cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((c) => c.trim());
}
function renderTable(headers, aligns, rows) {
  const th = headers.map((h, k) => `<th${aligns[k] ? ` style="text-align:${aligns[k]}"` : ""}>${renderInline(h)}</th>`).join("");
  const body = rows.map((r) =>
    `<tr>${r.map((c, k) => `<td${aligns[k] ? ` style="text-align:${aligns[k]}"` : ""}>${renderInline(c)}</td>`).join("")}</tr>`
  ).join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

// List renderer. An item owns every following line indented past its marker, so
// it can hold paragraphs, fenced code and nested lists — all rendered by
// recursion. Previously an item was a single line, so a fence indented under
// "1." ended the list and the numbering restarted at 1 afterwards.
function renderList(lines, start, slugger, labels) {
  const baseIndent = indentOf(lines[start]);
  const ordered = /^\s*\d+\./.test(lines[start]);
  const items = [];
  let loose = false;
  let i = start;

  while (i < lines.length) {
    // A blank run between two items keeps the list going (and makes it loose).
    // Without this an item ending in a fenced block closed the list, and the
    // next item opened a second <ol> that restarted the numbering at 1.
    if (lines[i].trim() === "") {
      let j = i;
      while (j < lines.length && lines[j].trim() === "") j++;
      const sibling = j < lines.length && indentOf(lines[j]) === baseIndent &&
        /^\s*([-*+]|\d+\.)\s+/.test(lines[j]);
      if (!sibling) break;
      loose = true;
      i = j;
      continue;
    }
    const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (!m || m[1].length !== baseIndent) break;
    const body = [m[3]];
    i++;
    while (i < lines.length) {
      if (lines[i].trim() === "") {
        // A blank line only continues the item if deeper content follows it.
        let j = i;
        while (j < lines.length && lines[j].trim() === "") j++;
        if (j >= lines.length || indentOf(lines[j]) <= baseIndent) break;
        for (let k = i; k < j; k++) body.push("");
        loose = true;
        i = j;
        continue;
      }
      if (indentOf(lines[i]) <= baseIndent) break;
      body.push(lines[i]);
      i++;
    }
    items.push(body);
  }

  const tag = ordered ? "ol" : "ul";
  const html = items.map((body) => {
    // task list:  - [ ] todo   /   - [x] done
    const task = body[0].match(/^\[([ xX])\]\s+(.*)$/);
    if (task) body = [task[2], ...body.slice(1)];
    const inner = renderItem(body, slugger, loose, labels);
    return task
      ? `<li class="tp-task"><input type="checkbox" disabled${task[1] === " " ? "" : " checked"}>${inner}</li>`
      : `<li>${inner}</li>`;
  }).join("");
  return { html: `<${tag}>${html}</${tag}>`, next: i };
}

// One list item. A lone line stays inline (a tight list keeps no <p>); anything
// richer goes back through the block renderer.
function renderItem(body, slugger, loose, labels) {
  if (body.length === 1) return renderInline(body[0]);
  const cont = body.slice(1).filter((l) => l.trim());
  const dedent = cont.length ? Math.min(...cont.map(indentOf)) : 0;
  const text = [body[0], ...body.slice(1).map((l) => l.slice(dedent))].join("\n");
  const html = markdownToHtml(text, { slugger, labels }).html;
  return loose ? html : html.replace(/^<p>([\s\S]*?)<\/p>/, "$1");
}

export { makeSlugger, escapeHtml };
