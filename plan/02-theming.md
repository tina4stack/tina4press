# Task 02: Theming that does not break

## Goal

Give a site real control over how it looks without ever handing it a component
model, and freeze the token contract so a tina4press upgrade cannot repaint
somebody's site.

## Context

VitePress theming was the sore point that helped push tina4.com off it. Worth
naming the actual failure modes, because they set the design constraints here:

1. **The token surface churned.** The `--vp-c-brand` to `--vp-c-brand-1` rename
   broke every site's `custom.css` at once. Dozens of variables, under-documented,
   renamed between versions.
2. **The escape hatch was all-or-nothing.** Anything past a colour meant ejecting
   into a custom theme: owning Vue components and re-reconciling them on every
   upgrade.
3. **Layout changes needed Vue.** A banner or a version switcher meant `<Layout>`
   slot overrides, so theming dragged in the framework tina4press exists to avoid.

The lesson is NOT "add more knobs". It is: keep a small contract that never churns,
and make the escape hatch cheap and partial instead of total.

### Where tina4press actually stands (measured 2026-08-05)

| | Count | Note |
|---|---|---|
| CSS variables defined in `theme.css` | 26 | 18 `--tp-*` plus 8 `--tk-*` syntax tokens |
| Variables exposed to config (`COLOR_VARS`) | 12 | brand, brand2, bg, bgSoft, bgMute, border, border2, fg, fg2, fg3, codeBg, sel |
| Syntax highlighting colours themeable | **0** | the 8 `--tk-*` tokens are not exposed |
| Font, layout widths themeable | **0** | `--tp-font`, `--tp-mono`, `--tp-max`, `--tp-content`, `--tp-sidebar-w`, `--tp-toc-w` not exposed |
| `customCss` config option | **none** | CSS can only be smuggled in through `head` |
| Layout override or slots | **none** | the layout is one template literal |
| Hardcoded colours outside the token block | **11 sites** | `#fff` on brand buttons, `#e0a844` warning, `#e5484d` danger, several `rgba(0,0,0,...)` shadows |

So the colour surface is small and sane, which is already better than VitePress.
The gaps are that it stops at colour, and there is no cheap escape hatch.

## Scope

- [ ] **Freeze and document the token contract.** The 12 colour keys are the public
      API. Write them down as frozen: additive changes only, never a rename. This is
      the direct answer to the `--vp-c-brand-1` lesson.
- [ ] **Expose the 8 `--tk-*` syntax tokens** through `colors.light.code.*` /
      `colors.dark.code.*`. A site can match its code blocks to its brand today only
      by overriding CSS by hand.
- [ ] **Expose typography and layout**: `font`, `mono`, `maxWidth`, `contentWidth`,
      `sidebarWidth`, `tocWidth`. Same friendly-key mapping, same frozen contract.
- [ ] **`customCss`**: a path (or array) appended after `theme.css` in the emitted
      assets. One config line, no `head` smuggling, correct cascade order by
      construction.
- [ ] **Tokenise the 11 hardcoded colours.** `#fff` on a brand button is wrong the
      moment a site picks a light brand colour. Warning and danger become
      `--tp-warning` / `--tp-danger`; shadows become `--tp-shadow`.
- [ ] **Layout slots as plain HTML strings, never components.** `themeConfig.slots`
      with a fixed set of named insertion points: `headerStart`, `headerEnd`,
      `sidebarTop`, `sidebarBottom`, `contentTop`, `contentBottom`, `footer`. A
      string, or a function returning a string, injected at build time. This buys
      the banner and the version switcher without a component model, and it cannot
      break on upgrade the way a Vue override does.
- [ ] **A theme regression test**: build a fixture site with every token overridden
      and assert the emitted `<style id="tp-colors">` carries all of them.

## Deliberately NOT doing

- A component model or a swappable theme directory. That is the VitePress mistake.
  If a site needs that much control it should fork the theme files, and the whole
  theme is 3 files and about 580 lines - forking it is genuinely cheap.
- A build step for CSS. `theme.css` stays a plain file a human can read.

## Tests

- [ ] `theme_tokens: every documented colour key reaches the emitted style block`
- [ ] `theme_tokens: an unknown key is ignored, not injected` (negative)
- [ ] `theme_tokens: a value containing < or > is stripped` (negative, injection)
- [ ] `custom_css: the file is emitted and linked after theme.css`
- [ ] `slots: a configured slot string appears at its insertion point`
- [ ] `slots: an unknown slot name is ignored` (negative)

## Bugs

- [ ] Brand buttons hardcode `color: #fff`, unreadable on a light brand colour
- [ ] Syntax colours cannot be themed at all
- [ ] No `customCss`; the only route is a `head` `<style>` entry, which is undocumented

## Commits

- (none yet)

## Status: Not started
