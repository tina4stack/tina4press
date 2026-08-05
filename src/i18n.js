// i18n.js — multi-language sites.
//
// The split that matters for a static site generator:
//
//   content  -> BUILD time. One page tree per locale (docs/fr/...). A French
//               reader downloads French prose only. Translating at runtime
//               would ship every language to every reader, which throws away
//               the weight advantage of not shipping a framework.
//   chrome   -> the ~20 UI strings. Resolved at build time for the static HTML,
//               and the same bundle is handed to the client for the strings
//               only JavaScript can produce (search results, chat errors).
//
// Locale switching is navigation, not state: /fr/guide/ IS a different page. So
// there is no reactive locale signal here — that would be code earning nothing.

// Every string the theme puts on screen. A site overrides any of them per
// locale via themeConfig.messages[locale].
export const DEFAULT_MESSAGES = {
  tocTitle: "On this page",
  editLink: "Edit this page",
  search: "Search",
  searchPlaceholder: "Search the docs…",
  searchEmpty: "Type to search the docs…",
  searchNoResults: "No results.",
  searchNavigate: "navigate",
  searchOpen: "open",
  searchClose: "close",
  menu: "Menu",
  toggleTheme: "Toggle theme",
  copyCode: "Copy code",
  permalink: "Permalink",
  overview: "Overview",
  more: "More",
  reference: "Reference",
  chatLabel: "Ask",
  chatPlaceholder: "Ask a question…",
  chatSources: "Sources",
  chatError: "Sorry — the assistant is unreachable right now.",
  // container labels, baked into the HTML at build time
  tip: "Tip", info: "Info", note: "Note",
  warning: "Warning", danger: "Danger", details: "Details",
};

// Right-to-left scripts by language subtag, matching tina4-js's list.
const RTL = new Set(["ar", "he", "fa", "ur", "ps", "dv", "syr", "ckb", "yi"]);

export const isRTL = (lang) => RTL.has(String(lang || "").split("-")[0].toLowerCase());
export const dirOf = (lang) => (isRTL(lang) ? "rtl" : "ltr");

// The locale keys that own a URL prefix. "root" is served at / and owns no prefix.
export function localeKeys(locales) {
  return Object.keys(locales || {}).filter((k) => k !== "root");
}

/** Which locale does this source path belong to? */
export function localeOf(relPath, locales) {
  if (!locales) return "root";
  const first = String(relPath).split("/")[0];
  return localeKeys(locales).includes(first) ? first : "root";
}

/**
 * The path with its locale prefix removed — the identity of a page ACROSS
 * locales. docs/fr/guide/routing.md and docs/guide/routing.md share the
 * logical path "guide/routing", which is what links translations together.
 */
export function logicalPath(relPath, locales) {
  const loc = localeOf(relPath, locales);
  const noExt = String(relPath).replace(/\.md$/, "");
  return loc === "root" ? noExt : noExt.slice(loc.length + 1);
}

/**
 * Merge the site config with a locale's overrides. A locale may override
 * title, description, lang, dir and any themeConfig key (nav, sidebar,
 * sectionLabels, messages).
 */
export function configForLocale(config, locale) {
  const def = (config.locales && config.locales[locale]) || {};
  const messages = {
    ...DEFAULT_MESSAGES,
    ...(config.themeConfig.messages || {}),
    ...((def.themeConfig && def.themeConfig.messages) || {}),
  };
  const lang = def.lang || (locale === "root" ? "en" : locale);
  return {
    ...config,
    ...(def.title ? { title: def.title } : {}),
    ...(def.description ? { description: def.description } : {}),
    // NOT top-level `lang`/`dir`: config.dir is already the site root path,
    // and shadowing it put a filesystem path into <html dir>.
    i18n: { locale, lang, dir: def.dir || dirOf(lang) },
    themeConfig: {
      ...config.themeConfig,
      ...(def.themeConfig || {}),
      messages,
    },
  };
}

/** Where a locale's home page lives: "" for root, "fr/" for fr. */
export const localeHome = (locale) => (locale === "root" ? "" : locale + "/");

/**
 * Translations of one page: [{ locale, lang, label, url, current }].
 * A locale that has no translation of this page falls back to its home, so the
 * switcher never offers a link into a 404.
 */
export function alternatesFor(page, pages, config) {
  const locales = config.locales;
  if (!locales) return [];
  const logical = logicalPath(page.relPath, locales);
  const byLocaleLogical = new Map();
  for (const p of pages) {
    byLocaleLogical.set(`${localeOf(p.relPath, locales)}::${logicalPath(p.relPath, locales)}`, p);
  }
  return Object.entries(locales).map(([locale, def]) => {
    const match = byLocaleLogical.get(`${locale}::${logical}`);
    const lang = def.lang || (locale === "root" ? "en" : locale);
    return {
      locale, lang,
      label: def.label || lang,
      url: match ? match.url : localeHome(locale),
      translated: !!match,
      current: locale === localeOf(page.relPath, locales),
    };
  });
}
