# Task 06: Accessibility and reading polish

## Goal

Make the theme usable by keyboard, by screen reader, in print, and by readers who
cannot take motion.

## Context

The CSS is in good shape: clean tokens, real light and dark, a warm dark theme.
The gaps are interaction and edge cases. Measured on
[src/theme/theme.css](tina4press/src/theme/theme.css) (306 lines) and
[src/theme/client.js](tina4press/src/theme/client.js):

| Feature | State |
|---|---|
| `prefers-reduced-motion` | **absent** - `scroll-behavior: smooth` is set globally with no opt-out |
| `@media print` | **absent** |
| `:focus-visible` styling | **only** on `.tp-copy` |
| Tab ARIA (`role=tablist/tab/tabpanel`) | **absent** - tabs are bare buttons |
| Tab keyboard navigation | **absent** |
| Search modal focus trap / focus restore | **absent** |
| `aria-expanded` on the menu toggle | **absent** |
| Skip-to-content link | **absent** |
| `<html lang>` | hardcoded `en` (task 03 fixes this) |

Polish is scheduled last on purpose: polish applied over a parser that eats
content is wasted work. Task 01 had to land first.

## Scope

- [ ] Tabs and code-group tabs: `role="tablist"/"tab"/"tabpanel"`, `aria-selected`,
      `aria-controls`, arrow-key navigation, roving tabindex
- [ ] Search modal: `aria-modal`, focus trap, focus restored to the opener on close,
      `role="listbox"`/`option` on results, `aria-live` result count
- [ ] `aria-expanded` on the mobile menu toggle, `aria-pressed` on the theme toggle,
      Escape closes the menu
- [ ] Skip-to-content link
- [ ] `:focus-visible` rings on every interactive element
- [ ] `@media (prefers-reduced-motion: reduce)`: kill smooth scrolling and transitions
- [ ] `@media print`: drop the chrome, expand link URLs, keep code blocks from
      splitting across pages
- [ ] WCAG AA contrast audit of both themes. Check `--tp-fg-3: #8a7d6d` on `#17130f`
      specifically.
- [ ] Images carry width/height to stop layout shift; figure captions from the title
- [ ] Heading scale rhythm, table and blockquote styling, callout icons
- [ ] `client.js` guards `e.key.toLowerCase()`, which throws when `e.key` is undefined

## Tests

Structure is testable without a browser; contrast is a computed check.

- [ ] `a11y: every tab carries role and aria-selected`
- [ ] `a11y: a tab panel is linked by aria-controls`
- [ ] `a11y: the skip link is the first focusable element`
- [ ] `a11y: the menu toggle exposes aria-expanded`
- [ ] `a11y: theme.css contains a prefers-reduced-motion block`
- [ ] `a11y: theme.css contains a print block`
- [ ] `contrast: every fg/bg token pair meets WCAG AA in both themes`

## Commits

- (none yet)

## Status: Not started
