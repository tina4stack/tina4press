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

## Code with a filename and description

Every code block gets a copy button. Add `title=` for a filename and `desc=` for
a one-line description — no plugin required, highlighting is built in.

```python title="src/routes/users.py" desc="A thin route; logic lives in src/app/"
@get("/users")
async def list_users(request, response):
    return response(User().select())
```

## The same example in four languages (code-group)

::: code-group

```python title="Python"
@get("/users")
async def list_users(request, response):
    return response(User().select())
```

```php title="PHP"
\Tina4\Get::add("/users", function($response) {
    return $response((new User())->select());
});
```

```javascript title="Node.js"
get("/users", async (req, res) => res.json(await new User().select()));
```

```ruby title="Ruby"
get "/users" do |request, response|
  response.json(User.new.select)
end
```

:::

## Next steps

Point it at real docs and run `tina4press dev`.
