// client.js — progressive enhancement for tina4press pages. Uses the tina4-js
// global (Tina4) loaded just before this script. Everything degrades: with JS
// off the page is fully readable; this adds theme toggle, code-copy, the ⌘K
// context search, mobile navigation, and an active-heading table of contents.

(function () {
  var T = window.Tina4 || {};
  var html = T.html, signal = T.signal;
  var base = window.__TP_BASE__ || "/";
  // Chrome strings for this page's locale, resolved at build time. tina4-js's
  // i18n gives us t() with {placeholder} interpolation over that bundle; the
  // locale itself never changes at runtime, because switching locale on a
  // static site is navigation to a different page tree.
  var I18N = window.__TP_I18N__ || {};
  var i18n = (T.createI18n && I18N.messages)
    ? T.createI18n({ locale: I18N.lang || "en", messages: (function () {
        var b = {}; b[I18N.lang || "en"] = I18N.messages; return b;
      })() })
    : null;
  var t = function (key, fallback) {
    if (i18n) { var v = i18n.t(key); if (v && v !== key) return v; }
    return (I18N.messages && I18N.messages[key]) || fallback;
  };
  var MARK = ""; // sentinel wrapping search matches before we build <mark>
  MARK = String.fromCharCode(1); // force a clean, non-empty sentinel
  var asset = function (p) { return (base.replace(/\/$/, "") + "/assets/" + p).replace(/\/{2,}/g, "/"); };

  // ---- theme toggle (persisted; matches the pre-paint inline script) ----
  var root = document.documentElement;
  var tt = document.getElementById("tp-theme-toggle");
  if (tt) tt.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("tp-theme", next); } catch (e) {}
  });

  // ---- mobile menu (nav + sidebar) ----
  var menu = document.getElementById("tp-mobile-menu");
  var mt = document.getElementById("tp-menu-toggle");
  if (mt && menu) {
    mt.addEventListener("click", function () { menu.hidden = !menu.hidden; });
    // close after tapping any link, or when tapping outside the panel
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a") || e.target === menu) menu.hidden = true;
    });
  }

  // ---- code copy ----
  document.querySelectorAll(".tp-copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var pre = btn.parentElement.querySelector("pre");
      var text = pre ? pre.innerText : "";
      navigator.clipboard.writeText(text).then(function () {
        btn.innerHTML = btn.getAttribute("data-check") || "✓";
        btn.classList.add("tp-copied");
        setTimeout(function () {
          btn.innerHTML = btn.getAttribute("data-clip") || "Copy";
          btn.classList.remove("tp-copied");
        }, 1400);
      });
    });
  });

  // ---- tabs (code-group + content tabs) ----
  function wireTabs(group, tabSel, paneSel, groupSel) {
    var own = function (el) { return el.closest(groupSel) === group; };
    var tabs = [].slice.call(group.querySelectorAll(tabSel)).filter(own);
    var panes = [].slice.call(group.querySelectorAll(paneSel)).filter(own);
    tabs.forEach(function (tab, k) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("tp-on"); });
        panes.forEach(function (p) { p.classList.remove("tp-on"); });
        tab.classList.add("tp-on");
        if (panes[k]) panes[k].classList.add("tp-on");
      });
    });
  }
  document.querySelectorAll(".tp-code-group").forEach(function (g) { wireTabs(g, ".tp-cg-tab", ".tp-code", ".tp-code-group"); });
  document.querySelectorAll(".tp-tabs").forEach(function (g) { wireTabs(g, ".tp-tab", ".tp-tab-pane", ".tp-tabs"); });

  // ---- active TOC on scroll ----
  var tocLinks = {};
  document.querySelectorAll(".tp-toc a").forEach(function (a) {
    tocLinks[a.getAttribute("href").slice(1)] = a;
  });
  if (Object.keys(tocLinks).length && "IntersectionObserver" in window) {
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          if (current) current.classList.remove("tp-active");
          current = tocLinks[en.target.id];
          if (current) current.classList.add("tp-active");
        }
      });
    }, { rootMargin: "-64px 0px -70% 0px" });
    document.querySelectorAll(".tp-content h2[id], .tp-content h3[id]").forEach(function (h) { io.observe(h); });
  }

  // ---- ⌘K context search ----
  var modal = document.getElementById("tp-search-modal");
  if (modal && html && signal) {
    var input = document.getElementById("tp-search-input");
    var resultsEl = document.getElementById("tp-search-results");
    var index = null, loading = false;
    var results = signal([]);
    var selIdx = signal(0);

    function loadIndex() {
      if (index || loading) return;
      loading = true;
      fetch(asset("search-index.json")).then(function (r) { return r.json(); })
        .then(function (data) { index = data; runSearch(input.value); })
        .catch(function () { index = []; });
    }
    function open() { modal.hidden = false; loadIndex(); setTimeout(function () { input.focus(); }, 0); }
    function close() { modal.hidden = true; input.value = ""; results.value = []; }

    var openBtn = document.getElementById("tp-search-open");
    if (openBtn) openBtn.addEventListener("click", open);
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
      if (e.key === "Escape" && !modal.hidden) close();
      if (!modal.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        var n = results.value.length; if (!n) return;
        selIdx.value = (selIdx.value + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
      }
      if (!modal.hidden && e.key === "Enter") {
        var hit = results.value[selIdx.value];
        if (hit) location.href = hit.url;
      }
    });
    modal.addEventListener("click", function (e) { if (e.target === modal) close(); });

    function runSearch(q) {
      q = (q || "").trim().toLowerCase();
      selIdx.value = 0;
      if (!q || !index) { results.value = []; return; }
      var terms = q.split(/\s+/);
      var scored = [];
      for (var p = 0; p < index.length; p++) {
        var page = index[p];
        // a French reader should not be shown English hits
        if (I18N.locale && page.locale && page.locale !== I18N.locale) continue;
        var hay = (page.title + " " + (page.headings || []).join(" ") + " " + page.text).toLowerCase();
        var score = 0, ok = true;
        for (var t = 0; t < terms.length; t++) {
          if (hay.indexOf(terms[t]) < 0) { ok = false; break; }
          score += page.title.toLowerCase().indexOf(terms[t]) >= 0 ? 10 : 1;
        }
        if (!ok) continue;
        scored.push({ page: page, score: score, ctx: context(page.text, terms[0]) });
      }
      scored.sort(function (a, b) { return b.score - a.score; });
      results.value = scored.slice(0, 12).map(function (s) {
        return { url: s.page.url, title: s.page.title, crumb: s.page.crumb || "", ctx: s.ctx };
      });
    }
    function context(text, term) {
      var i = text.toLowerCase().indexOf(term);
      if (i < 0) return text.slice(0, 120);
      var start = Math.max(0, i - 40), end = Math.min(text.length, i + 80);
      var snip = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
      var re = new RegExp("(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      return snip.replace(re, MARK + "$1" + MARK);
    }
    function markCtx(s) {
      var frag = document.createDocumentFragment();
      var parts = String(s).split(MARK);
      for (var i = 0; i < parts.length; i++) {
        if (i % 2 === 1) { var m = document.createElement("mark"); m.textContent = parts[i]; frag.append(m); }
        else frag.append(document.createTextNode(parts[i]));
      }
      return frag;
    }

    input.addEventListener("input", function () { runSearch(input.value); });

    // reactive results list (tina4-js)
    var list = html`${function () {
      var r = results.value;
      if (!input.value.trim()) return html`<div class="tp-search-empty">${t("searchEmpty", "Type to search the docs…")}</div>`;
      if (!r.length) return html`<div class="tp-search-empty">${t("searchNoResults", "No results.")}</div>`;
      return r.map(function (hit, i) {
        return html`<a class=${function () { return "tp-sr" + (selIdx.value === i ? " tp-sel" : ""); }} href=${hit.url}>
          <div class="tp-sr-title">${hit.title}</div>
          ${hit.crumb ? html`<div class="tp-sr-crumb">${hit.crumb}</div>` : ""}
          <div class="tp-sr-ctx">${markCtx(hit.ctx)}</div>
        </a>`;
      });
    }}`;
    resultsEl.append(list);
  }

  // ---- built-in RAG chat (themeConfig.chat) ----
  var chatCfg = window.__TP_CHAT__;
  if (chatCfg && chatCfg.api) {
    var api = chatCfg.api.replace(/\/+$/, "");
    var askPath = chatCfg.askPath || "/v1/ask";
    // Generic: a static chat.language, else the first path segment as a hint
    // (harmless for any docs site; the backend treats language as optional).
    var lang = chatCfg.language || (location.pathname.match(/^\/([^/]+)\//) || [])[1] || "";
    var wrap = document.createElement("div");
    wrap.className = "tp-chat";
    wrap.innerHTML =
      '<button class="tp-chat-btn" aria-label="' + esc(chatCfg.label || t("chatLabel", "Ask")) + '">💬 ' + esc(chatCfg.label || t("chatLabel", "Ask")) + '</button>' +
      '<div class="tp-chat-panel" hidden>' +
      '<div class="tp-chat-head"><strong>' + esc(chatCfg.label || t("chatLabel", "Ask")) + '</strong>' +
      (chatCfg.model ? '<span class="tp-chat-model">' + esc(chatCfg.model) + '</span>' : '') + '</div>' +
      '<div class="tp-chat-log"></div>' +
      '<form class="tp-chat-form"><input class="tp-chat-input" placeholder="' +
      esc(chatCfg.placeholder || t("chatPlaceholder", "Ask a question…")) + '" autocomplete="off"><button type="submit">Ask</button></form>' +
      '</div>';
    document.body.appendChild(wrap);
    var cbtn = wrap.querySelector(".tp-chat-btn");
    var panel = wrap.querySelector(".tp-chat-panel");
    var log = wrap.querySelector(".tp-chat-log");
    var form = wrap.querySelector(".tp-chat-form");
    var cin = wrap.querySelector(".tp-chat-input");
    cbtn.addEventListener("click", function () { panel.hidden = !panel.hidden; if (!panel.hidden) cin.focus(); });

    function bubble(role, html) {
      var b = document.createElement("div");
      b.className = "tp-chat-msg tp-chat-" + role;
      b.innerHTML = html;
      log.appendChild(b); log.scrollTop = log.scrollHeight; return b;
    }
    function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
    function md(t) {
      var h = esc(t);
      h = h.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, l, c) { return "<pre><code>" + c.replace(/\n$/, "") + "</code></pre>"; });
      h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
      h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, text, url) {
        // CommonMark [text](<url>): strip angle-bracket delimiters. esc() ran first, so
        // they arrive as &lt;/&gt; — handle both. Then drop stray trailing punctuation an
        // LLM sometimes appends. Without this a `[source](<…md>)` becomes a `…md>` 404.
        url = url.replace(/^(?:&lt;|<)+/, "").replace(/(?:&gt;|>)+$/, "").replace(/[.,;:!?]+$/, "");
        return '<a href="' + url + '" target="_blank" rel="noreferrer">' + text + '</a>';
      });
      h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      // don't turn <br> inside <pre> blocks
      h = h.replace(/\n/g, "<br>");
      return h.replace(/<pre>([\s\S]*?)<\/pre>/g, function (m) { return m.replace(/<br>/g, "\n"); });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = cin.value.trim(); if (!q) return;
      cin.value = ""; bubble("you", esc(q));
      var thinking = bubble("bot", "…");
      fetch(api + askPath, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, language: lang || undefined, k: 6, stream: false }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        thinking.innerHTML = md(d.answer || d.response || d.text || "(no answer)");
        // Render the structured sources[] as clean clickable citations (always valid URLs,
        // unlike inline links an LLM might mangle). Deduplicated by URL.
        var srcs = (d.sources || []).filter(function (s) { return s && s.url; });
        if (srcs.length) {
          var seen = {}, items = "";
          for (var i = 0; i < srcs.length; i++) {
            var u = srcs[i].url; if (seen[u]) continue; seen[u] = 1;
            // drop the trailing "(path)" the backend appends to titles for a cleaner label
            var label = (srcs[i].title || u).replace(/\s*\([^)]*\)\s*$/, "");
            items += '<a class="tp-chat-src" href="' + esc(u) + '" target="_blank" rel="noreferrer">' +
                     esc(label) + "</a>";
          }
          if (items) {
            var sb = document.createElement("div");
            sb.className = "tp-chat-sources";
            sb.innerHTML = '<div class="tp-chat-sources-label">' + esc(t("chatSources", "Sources")) + '</div>' + items;
            log.appendChild(sb);
          }
        }
        log.scrollTop = log.scrollHeight;
      }).catch(function () { thinking.textContent = t("chatError", "Sorry — the assistant is unreachable right now."); });
    });
  }
})();
