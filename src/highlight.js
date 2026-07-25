// highlight.js — build-time, dependency-free syntax highlighting for fenced
// code. One line at a time; input is HTML-escaped, so output is always safe to
// drop into <pre><code> and can never execute. Includes the decorator fix
// (leading @ / $ is always consumed) so Python/Ruby/PHP samples never hang.

const KEYWORDS = {
  python: "def class return if elif else for while import from as with try except finally raise yield lambda global nonlocal pass break continue in is not and or None True False async await self assert del match case",
  php: "function class public private protected static return if else elseif for foreach while do switch case break continue new echo print try catch finally throw namespace use extends implements interface trait abstract final const var global instanceof as fn match null true false",
  ruby: "def class module return if elsif else unless case when then for while do begin rescue ensure raise yield lambda proc nil true false self require require_relative attr_accessor attr_reader attr_writer end new and or not in",
  javascript: "function class return if else for while do switch case break continue new const let var import export from default extends async await yield try catch finally throw typeof instanceof in of null undefined true false this super static get set",
  typescript: "function class return if else for while do switch case break continue new const let var import export from default extends implements interface type enum async await yield try catch finally throw typeof instanceof in of null undefined true false this super static get set public private protected readonly abstract as keyof namespace declare",
  sql: "select from where insert update delete into values create table alter drop primary key foreign references index join left right inner outer on group by order having limit offset as and or not null distinct set",
  bash: "if then else elif fi for while do done case esac function return export local echo cd exit source set unset in",
  json: "",
};
KEYWORDS.js = KEYWORDS.javascript;
KEYWORDS.ts = KEYWORDS.typescript;
KEYWORDS.nodejs = KEYWORDS.typescript;
KEYWORDS.sh = KEYWORDS.bash;
KEYWORDS.yaml = "";
KEYWORDS.yml = "";

const LINE_COMMENT = {
  python: "#", ruby: "#", bash: "#", sh: "#", yaml: "#", yml: "#",
  php: "//", javascript: "//", typescript: "//", js: "//", ts: "//", nodejs: "//",
  sql: "--",
};

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function kwSet(lang) {
  const src = KEYWORDS[lang] != null ? KEYWORDS[lang] : KEYWORDS.javascript;
  return new Set(src.split(/\s+/).filter(Boolean));
}

// Frond / Twig / Handlebars: highlight the delimiters but keep contents literal.
function frondish(line) {
  return escapeHtml(line)
    .replace(/(\{%[^%]*?%\})/g, '<span class="tk-tag">$1</span>')
    .replace(/(\{\{[^}]*?\}\})/g, '<span class="tk-var">$1</span>');
}

export function highlight(line, language = "") {
  const lang = (language || "").toLowerCase();
  if (lang === "twig" || lang === "frond" || lang === "html" || lang === "handlebars") {
    return frondish(line);
  }
  if (lang === "json") return highlightJson(line);
  if (KEYWORDS[lang] == null && lang !== "" && !LINE_COMMENT[lang]) {
    return escapeHtml(line); // unknown language: safe plain text
  }

  const keywords = kwSet(lang);
  const lineComment = LINE_COMMENT[lang];
  let out = "";
  let i = 0;
  const n = line.length;

  while (i < n) {
    const ch = line[i];
    if (lineComment && line.startsWith(lineComment, i)) {
      out += `<span class="tk-comment">${escapeHtml(line.slice(i))}</span>`;
      break;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n && line[j] !== ch) { if (line[j] === "\\") j++; j++; }
      out += `<span class="tk-string">${escapeHtml(line.slice(i, Math.min(j + 1, n)))}</span>`;
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch) && (i === 0 || /[^A-Za-z0-9_]/.test(line[i - 1]))) {
      let j = i;
      while (j < n && /[0-9a-fx_.]/i.test(line[j])) j++;
      out += `<span class="tk-number">${escapeHtml(line.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    if (/[A-Za-z_$@]/.test(ch)) {
      let j = i + 1; // always consume the leading char (@ / $ safe)
      while (j < n && /[A-Za-z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (keywords.has(word)) out += `<span class="tk-keyword">${escapeHtml(word)}</span>`;
      else if (line[j] === "(") out += `<span class="tk-fn">${escapeHtml(word)}</span>`;
      else out += escapeHtml(word);
      i = j;
      continue;
    }
    out += escapeHtml(ch);
    i++;
  }
  return out;
}

function highlightJson(line) {
  return escapeHtml(line)
    .replace(/(&quot;(?:\\.|[^&])*?&quot;)(\s*:)/g, '<span class="tk-key">$1</span>$2')
    .replace(/:(\s*)(&quot;(?:\\.|[^&])*?&quot;)/g, ':$1<span class="tk-string">$2</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="tk-keyword">$1</span>')
    .replace(/(-?\b\d+(?:\.\d+)?\b)/g, '<span class="tk-number">$1</span>');
}
