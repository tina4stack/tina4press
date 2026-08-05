---
title: Theme showcase
---

# Theme showcase

A page that exercises every component so the vanilla theme can be judged at a glance.
Inline `code`, a [link](/), and **bold** plus _italic_ text.

## Callouts

::: tip
Pink leads. This is the brand colour.
:::

::: info
Blue supports. Used for informational notes.
:::

::: warning
Something needs attention before you continue.
:::

::: danger
This will delete data.
:::

## Code

```js{2} title="app.js" desc="Wires the login form"
const app = start();
app.get("/login", showForm);
app.listen(7145);
```

::: code-group
```python title="app.py"
@get("/hello")
async def hello(): return {"ok": True}
```
```php title="app.php"
$app->get("/hello", fn() => ["ok" => true]);
```
:::

## Table

| Option | Type | Default | Notes |
|---|---|---|---|
| `cleanUrls` | boolean | `false` | Directory-style URLs |
| `srcDir` | string | `docs` | Where markdown lives |
| `search` | boolean | `true` | Client-side search |

## Lists

1. Install the package:

   ```bash
   npm i -D tina4press
   ```

2. Write a page.
3. Run the build.

- [x] Task lists render checkboxes
- [ ] This one is not done

## Cards

::: cards
== ⚡ Fast
271 pages in under a second.
== 🪶 Small
No build-time dependencies.
== 🔒 Safe
Code is never interpreted.
:::

> A blockquote, for when the docs quote something worth quoting.
