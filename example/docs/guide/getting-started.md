---
title: Getting Started
description: Install tina4press, write markdown, ship a docs site.
order: 1
---

# Getting Started

tina4press turns a folder of Markdown into a fast, searchable docs site with a
tina4-js theme. No Vue, no runtime framework on the page but tina4-js itself.

## Install

```bash
npm i -D tina4press
```

## Project layout

```
my-docs/
  tina4press.config.js
  docs/
    index.md
    guide/getting-started.md
    public/            # static assets, copied as-is
```

## Features

| Feature | Notes |
|---|---|
| Code-safe markdown | `{% %}` / `{{ }}` never interpreted |
| Auto sidebar | built from your folder structure |
| Context search | ⌘K, ranked, with snippets |
| Dark / light | persisted, no flash of wrong theme |
| Line highlighting | ` ```js{2,4} ` |

## Line highlighting demo

```python{2,5} title="src/routes/users.py"
@get("/users")
async def list_users(request, response):   # this line is highlighted
    users = User().select()
    return response(users)
    # so is this one
```

::: warning Heads up
Sidebar order follows a numeric filename prefix (`01-intro.md`), then a
frontmatter `order:`, then the title.
:::

## Next steps

Point it at real docs and run `tina4press dev`.
