// Regression tests for the markdown renderer.
//
// Every case here is named for the defect it locks in, and each defect gets
// both a positive assertion (the right thing is produced) and a negative one
// (the broken output can never come back). All of them were measured against
// the real tina4.com corpus before the fix landed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "../src/markdown.js";

const render = (md) => markdownToHtml(md).html;
// Prose only. Escaping inside a code block is correct behaviour, so corruption
// checks must never look there.
const prose = (md) =>
  render(md).replace(/<pre[\s\S]*?<\/pre>/g, " ").replace(/<code[\s\S]*?<\/code>/g, " ");

// ---------------------------------------------------------------------------
// Code is sacred. The whole reason tina4press exists.
// ---------------------------------------------------------------------------

test("code_is_sacred: frond and handlebars survive a fenced block", () => {
  const html = render("```twig\n{% if user %}{{ user.name }}{% endif %}\n```");
  assert.match(html, /\{% if user %\}/);
  assert.match(html, /\{\{ user\.name \}\}/);
});

test("code_is_sacred: a raw script tag in a fence is escaped, never executed", () => {
  const html = render("```html\n<script>alert(1)</script>\n```");
  assert.match(html, /&lt;script/);          // the highlighter may span-wrap the tag name
  assert.doesNotMatch(html, /<script>alert/); // but it must never be a live tag
});

test("code_is_sacred: inline code keeps its braces", () => {
  assert.match(render("Use `{{ x }}` in a template."), /<code>\{\{ x \}\}<\/code>/);
});

// ---------------------------------------------------------------------------
// Autolinks. Measured: 1 live page silently dropped its URL.
// ---------------------------------------------------------------------------

test("autolink: <https://…> renders a real anchor", () => {
  const html = render("See <https://tina4.com> for docs.");
  assert.match(html, /<a href="https:\/\/tina4\.com"[^>]*>https:\/\/tina4\.com<\/a>/);
});

test("autolink: never emitted as a literal unknown tag (renders as nothing)", () => {
  assert.doesNotMatch(prose("See <https://tina4.com> for docs."), /<https?:\/\//);
});

test("autolink: mailto works too", () => {
  assert.match(render("<mailto:a@b.com>"), /href="mailto:a@b\.com"/);
});

// ---------------------------------------------------------------------------
// HTML comments. Measured: 8 live pages showed the author's notes to readers.
// ---------------------------------------------------------------------------

test("html_comment: a block comment produces no output", () => {
  const html = render("<!-- internal note: fix later -->\n\nVisible text.");
  assert.match(html, /<p>Visible text\.<\/p>/);
  assert.doesNotMatch(html, /internal note/);
});

test("html_comment: never escaped into view", () => {
  assert.doesNotMatch(prose("<!-- note -->\n\nBody."), /&lt;!--/);
});

test("html_comment: a multi-line comment is consumed whole", () => {
  const html = render("<!--\nline one\nline two\n-->\n\nAfter.");
  assert.doesNotMatch(html, /line one/);
  assert.match(html, /<p>After\.<\/p>/);
});

test("html_comment: an inline comment is stripped from a paragraph", () => {
  assert.equal(render("Before <!-- hidden --> after."), "<p>Before  after.</p>");
});

test("html_comment: a comment inside a fence is still shown (it is code)", () => {
  assert.match(render("```html\n<!-- sample -->\n```"), /&lt;!-- sample --&gt;/);
});

// ---------------------------------------------------------------------------
// Multi-line HTML blocks. Measured: 1 live page emitted </div></p>.
// ---------------------------------------------------------------------------

test("html_block: a multi-line div passes through untouched", () => {
  const html = render('<div class="x">\n  <span>hi</span>\n</div>');
  assert.match(html, /<div class="x">/);
  assert.match(html, /<\/div>/);
});

test("html_block: the closing tag is never swallowed into a paragraph", () => {
  assert.doesNotMatch(render('<div class="x">\n  text\n</div>'), /<\/div><\/p>/);
});

test("html_block: a script body is not markdown-processed", () => {
  const html = render("<script>\nvar a = 1_000;\n</script>");
  assert.match(html, /var a = 1_000;/);
  assert.doesNotMatch(html, /<em>/);
});

test("html_block: markdown after a blank line still renders", () => {
  const html = render("<div>raw</div>\n\nA *real* paragraph.");
  assert.match(html, /<p>A <em>real<\/em> paragraph\.<\/p>/);
});

// ---------------------------------------------------------------------------
// Lists holding block content. Measured: 4 live files split their install steps.
// ---------------------------------------------------------------------------

test("list_block: a fenced block inside an item keeps one list", () => {
  const html = render("1. Run this:\n\n   ```bash\n   npm i\n   ```\n\n2. Then done.");
  assert.equal((html.match(/<ol>/g) || []).length, 1, "the list must not be split in two");
});

test("list_block: numbering is not restarted after a code block", () => {
  const html = render("1. Run this:\n\n   ```bash\n   npm i\n   ```\n\n2. Then done.");
  assert.match(html, /Then done/);
  assert.equal((html.match(/<\/ol>/g) || []).length, 1);
});

test("list_block: the fence lands inside the item", () => {
  const html = render("1. Run:\n\n   ```bash\n   npm i\n   ```\n");
  const li = html.slice(html.indexOf("<li>"), html.indexOf("</li>"));
  assert.match(li, /tp-code/);
});

test("list_block: a nested list still nests", () => {
  const html = render("- one\n  - inner\n- two");
  assert.match(html, /<li>one\s*<ul><li>inner<\/li><\/ul><\/li>/);
});

test("list_block: a plain tight list keeps no paragraph wrapper", () => {
  assert.equal(render("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
});

// ---------------------------------------------------------------------------
// Task lists. Measured: 4 live pages showed literal brackets.
// ---------------------------------------------------------------------------

test("task_list: an unchecked box renders a disabled checkbox", () => {
  const html = render("- [ ] todo one");
  assert.match(html, /<input type="checkbox" disabled>/);
  assert.match(html, /todo one/);
});

test("task_list: a checked box renders checked", () => {
  assert.match(render("- [x] done two"), /<input type="checkbox" disabled checked>/);
});

test("task_list: no literal square brackets survive", () => {
  assert.doesNotMatch(render("- [ ] todo\n- [x] done"), /<li[^>]*>\[[ x]\]/);
});

// ---------------------------------------------------------------------------
// Placeholder forgery. Latent: prose shaped like an internal sentinel used to
// be destroyed and replaced with the string "undefined".
// ---------------------------------------------------------------------------

test("placeholder: prose shaped like the old sentinel survives intact", () => {
  assert.equal(
    render("Header H0 is the first `a` one."),
    "<p>Header H0 is the first <code>a</code> one.</p>"
  );
});

test("placeholder: the word undefined is never emitted", () => {
  const cases = ["Header H0 is first.", "Register C0 holds it.", "See H1 and C2 there."];
  for (const md of cases) assert.doesNotMatch(render(md), /undefined/, `forged by: ${md}`);
});

test("placeholder: a NUL in the source cannot forge one", () => {
  const md = `Text ${String.fromCharCode(0)}0${String.fromCharCode(0)} and \`x\`.`;
  assert.doesNotMatch(render(md), /undefined/);
});

// ---------------------------------------------------------------------------
// Attribute escaping.
// ---------------------------------------------------------------------------

test("attr_escape: a quote in an href cannot break out of the attribute", () => {
  const html = render('[click](a"onmouseover="alert(1))');
  assert.doesNotMatch(html, /"onmouseover="/);
  assert.match(html, /&quot;/);
});

test("attr_escape: a quote in an image alt is escaped", () => {
  assert.doesNotMatch(render('![a"b](x.png)'), /alt="a"b"/);
});

test("attr_escape: an ordinary link is untouched", () => {
  assert.match(render("[docs](/guide/)"), /<a href="\/guide\/">docs<\/a>/);
});

test("attr_escape: a snake_case url keeps its underscores", () => {
  assert.match(render("[dl](Viewer_0.1.0_x64.exe)"), /href="Viewer_0\.1\.0_x64\.exe"/);
});

// ---------------------------------------------------------------------------
// Tables.
// ---------------------------------------------------------------------------

test("table: a pipe inside inline code stays in one cell", () => {
  const html = render("| a | b |\n|---|---|\n| `x\\|y` | z |");
  assert.equal((html.match(/<td/g) || []).length, 2, "the row must have exactly two cells");
});

test("table: a code span with a pipe is not split", () => {
  const html = render("| cmd | note |\n|---|---|\n| `a|b` | picks one |");
  assert.match(html, /picks one/);
  assert.equal((html.match(/<td/g) || []).length, 2);
});

test("table: an ordinary table still renders", () => {
  const html = render("| a | b |\n|---|---|\n| 1 | 2 |");
  assert.equal((html.match(/<th[ >]/g) || []).length, 2); // [ >] so <thead> is not counted
  assert.equal((html.match(/<td[ >]/g) || []).length, 2);
});

// ---------------------------------------------------------------------------
// Backslash escapes.
// ---------------------------------------------------------------------------

test("backslash: an escaped asterisk stays literal", () => {
  assert.equal(render("A literal \\*star\\* here."), "<p>A literal *star* here.</p>");
});

test("backslash: no stray backslash is left before emphasis", () => {
  assert.doesNotMatch(render("A literal \\*star\\* here."), /\\<em>/);
});

test("backslash: an escaped underscore stays literal", () => {
  assert.equal(render("snake\\_case\\_name"), "<p>snake_case_name</p>");
});

test("backslash: real emphasis still works", () => {
  assert.match(render("A *real* emphasis."), /<em>real<\/em>/);
});

// ---------------------------------------------------------------------------
// Things that already worked and must keep working.
// ---------------------------------------------------------------------------

test("regress: a link label may contain inline code", () => {
  assert.match(render("See [`plan.md`](plan.md)."), /<a href="plan\.md"><code>plan\.md<\/code><\/a>/);
});

test("regress: two adjacent links both render", () => {
  const html = render("[a](1.md) [b](2.md)");
  assert.equal((html.match(/<a href/g) || []).length, 2);
});

test("regress: headings still produce an id, an anchor and a toc entry", () => {
  const { html, toc } = markdownToHtml("## The Section");
  assert.match(html, /<h2 id="the-section">/);
  assert.equal(toc.length, 1);
  assert.equal(toc[0].slug, "the-section");
});

test("regress: an unknown container never loops the parser", () => {
  const html = render("::: mystery\nbody\n:::\n\nafter");
  assert.match(html, /tp-mystery/);
  assert.match(html, /after/);
});

test("regress: containers, tabs and code-groups still render", () => {
  assert.match(render("::: tip\nhi\n:::"), /tp-callout tp-tip/);
  assert.match(render("::: tabs\n== One\na\n== Two\nb\n:::"), /tp-tabs-nav/);
  assert.match(render("::: code-group\n```js\na\n```\n```py\nb\n```\n:::"), /tp-cg-tabs/);
});
