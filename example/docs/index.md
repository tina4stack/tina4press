---
title: Home
description: tina4press — VitePress-like docs, zero Vue, code is sacred.
---

# tina4press

A tiny, **zero-Vue** static site generator for documentation, built on
[tina4-js](https://tina4.com). Familiar if you know VitePress — but nothing
scans your content for template syntax, so documenting Tina4's own templates
just works.

## Why it exists

VitePress renders Markdown through Vue, so `{{ }}` in prose (or even in a code
block) gets interpolated, and Frond/Twig `{% %}` fights the tooling. tina4press
has **no template engine on your content**: fenced and inline code are escaped
and emitted verbatim.

::: tip Code is sacred
Everything in a code block below renders exactly as written — no escaping
gymnastics, no `v-pre`.
:::

## A Frond template, documented as-is

```twig title="src/templates/user.twig"
{% live user_card %}
  <h2>{{ user.name }}</h2>
  {% if user.admin %}
    <span class="badge">admin</span>
  {% endif %}
{% endlive %}
```

## Handlebars, JSX, raw HTML — all literal

```js
const t = `Hello {{ name }}`;            // braces are just text
const el = <div>{count}</div>;           // JSX, untouched
document.write("<script>alert(1)</script>"); // not executed, shown as text
```

Inline works too: `{{ user.email }}` and `{% csrf %}` render literally.

## Get going

```bash
npx tina4press dev example      # live-reload dev server
npx tina4press build example    # static site to dist/
```
