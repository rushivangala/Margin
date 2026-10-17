/* Kit — shared runtime for Calculator, Clock, Daybook, Files and Photos (assets/www/kit/kit.js).
   One theme engine, one appearance picker, edge-to-edge insets, predictive back and haptics,
   identical in every app. Talks to Android through window.KitNative (KitBridge.java); in a desktop
   browser it falls back to sensible defaults so every screen can still be previewed. */
(function (root) {
  'use strict';
  var VERSION = '1.0.0';
  var N = root.KitNative || null;

  /* ---------- themes ----------
     Material 3 colour roles. Token order:
     bg low cont high ink muted outline pri on-pri pri-c on-pri-c sec sec-c on-sec-c err err-c ok warn p1 inv-pri on-ev
     The second string is a 7-colour palette for categories (blue aqua purple orange green yellow red). */
  var TOKENS = ['bg', 'low', 'cont', 'high', 'ink', 'muted', 'outline', 'pri', 'on-pri', 'pri-c', 'on-pri-c', 'sec', 'sec-c', 'on-sec-c', 'err', 'err-c', 'ok', 'warn', 'p1', 'inv-pri', 'on-ev'];
  var DEFS = [
    ['gruvbox', 'Gruvbox', 1, '#282828 #32302f #3c3836 #504945 #ebdbb2 #afa18e #665c54 #fabd2f #282828 #564929 #fbdc8e #83a598 #3a4a48 #cfe3d9 #fb4934 #5a2a24 #b8bb26 #fe8019 #83a598 #86570f #282828', '#83a598 #8ec07c #d3869b #fe8019 #b8bb26 #fabd2f #fb4934'],
    ['nord', 'Nord', 1, '#2e3440 #353c4a #3b4252 #434c5e #eceff4 #a5aebe #56607a #88c0d0 #1f2530 #3a5563 #d2ecf3 #b48ead #4a4256 #ead9e6 #e08a92 #5b3a42 #a3be8c #d08770 #81a1c1 #467089 #2e3440', '#81a1c1 #8fbcbb #b48ead #d08770 #a3be8c #ebcb8b #bf616a'],
    ['everforest', 'Everforest', 1, '#2d353b #343f44 #3d484d #475258 #d3c6aa #adb7af #56635f #a7c080 #232a2e #425047 #dbe7c2 #7fbbb3 #3a4f52 #d3ebe7 #e67e80 #514045 #a7c080 #e69875 #7fbbb3 #4a5a00 #232a2e', '#7fbbb3 #83c092 #d699b6 #e69875 #a7c080 #dbbc7f #e67e80'],
    ['tokyo-night', 'Tokyo Night', 1, '#1a1b26 #1f2335 #24283b #2f3549 #c0caf5 #9aa5ce #414868 #7aa2f7 #15161e #2f3b6b #d0dcff #bb9af7 #3b2f5a #e6d9ff #f7768e #4a2530 #9ece6a #ff9e64 #7dcfff #284eb3 #15161e', '#7aa2f7 #73daca #bb9af7 #ff9e64 #9ece6a #e0af68 #f7768e'],
    ['catppuccin', 'Catppuccin', 1, '#1e1e2e #262637 #313244 #45475a #cdd6f4 #a6adc8 #585b70 #cba6f7 #1e1e2e #45375f #ecdcff #94e2d5 #2c4a4a #d4f5ef #f38ba8 #4f2a36 #a6e3a1 #fab387 #89b4fa #7832d2 #1e1e2e', '#89b4fa #94e2d5 #cba6f7 #fab387 #a6e3a1 #f9e2af #f38ba8'],
    ['solarized', 'Solarized', 1, '#002b36 #073642 #0c3f4c #174d5b #eee8d5 #97a5a5 #2e5a66 #b58900 #002b36 #4a4515 #f3e2a6 #2aa198 #0f4a4a #c9efe9 #ec5f57 #4d2020 #859900 #cb4b16 #268bd2 #7a5c00 #002b36', '#268bd2 #2aa198 #6c71c4 #cb4b16 #859900 #b58900 #dc322f'],
    ['amoled', 'AMOLED', 1, '#000000 #0e0e0e #1a1a1a #2a2a2a #f2f2f2 #a0a0a0 #3a3a3a #ffffff #000000 #2a2a2a #ffffff #bbbbbb #222222 #eeeeee #ff6b6b #3a1616 #8bd88b #ffb454 #7fb2ff #000000 #000000', '#77aaff #55dddd #cc99ff #ffaa44 #88dd88 #ffdd55 #ff6688'],
    ['paper', 'Paper', 0, '#f4efe5 #ebe5d8 #e3dccb #d8cfbb #2b2b28 #676053 #b5aa93 #a8432f #fff8f0 #f0d5c9 #5a1d12 #3a6a8a #d5e1e8 #16384d #a3301f #f3d3cc #55733a #a8641f #3a6a8a #f0a898 #ffffff', '#3a6a8a #4f7a5a #8a4f7d #b8742a #6b7f2a #9a7a1a #a8432f'],
    ['gruvbox-light', 'Gruvbox light', 0, '#fbf1c7 #f2e5bc #ebdbb2 #d5c4a1 #3c3836 #665c54 #bdae93 #af3a03 #fbf1c7 #f2d98c #4a2c00 #076678 #d4e3df #0b3b44 #9d0006 #f4cfc6 #79740e #b57614 #076678 #fe8019 #ffffff', '#076678 #427b58 #8f3f71 #af3a03 #79740e #b57614 #9d0006'],
    ['everforest-light', 'Everforest light', 0, '#fdf6e3 #f4f0d9 #eee8d5 #e0dcc7 #3a464c #5d6b71 #bec5b2 #5c7000 #fdf6e3 #dfe6c2 #2c3600 #3a7f9c #d9e8ea #163a46 #c0291f #f6d6cf #5c7000 #b5400f #2f7cab #a7c080 #ffffff', '#2f7cab #2a8a66 #b54d96 #c4601c #6f8000 #a77a00 #d63e3b'],
    ['solarized-light', 'Solarized light', 0, '#fdf6e3 #f5efdc #eee8d5 #e3dcc6 #073642 #566c73 #b8b3a0 #1a6aa3 #fdf6e3 #d9e6f0 #0b3a5c #1f7f78 #d7ebe6 #0d3b37 #c0291f #f6d6cf #6b7b00 #b5400f #1a6aa3 #8fc4ef #ffffff', '#268bd2 #2aa198 #6c71c4 #cb4b16 #6b7b00 #a07a00 #c0291f']
  ];
  var THEMES = {}, IDS = [];
  DEFS.forEach(function (d) {
    var v = d[3].split(' '), c = {};
    TOKENS.forEach(function (k, i) { c[k] = v[i]; });
    THEMES[d[0]] = { id: d[0], name: d[1], dark: !!d[2], c: c, ev: d[4].split(' ') };
    IDS.push(d[0]);
  });

  /* ---------- appearance prefs (shared shape in every app) ---------- */
  var KEY = 'kit.appearance';
  var DEFAULTS = { mode: 'system', light: 'paper', dark: 'gruvbox', dyn: false };
  function loadPrefs() {
    var p = {};
    try { p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { p = {}; }
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = p[k] !== undefined ? p[k] : DEFAULTS[k]; });
    if (!THEMES[out.light] || THEMES[out.light].dark) out.light = DEFAULTS.light;
    if (!THEMES[out.dark] || !THEMES[out.dark].dark) out.dark = DEFAULTS.dark;
    return out;
  }
  var prefs = loadPrefs();
  function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} }

  var dyn = null;
  try { dyn = N && N.dynamicColors ? JSON.parse(N.dynamicColors() || 'null') : null; } catch (e) { dyn = null; }

  var mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;
  function systemDark() {
    try { if (N && N.isNight) return !!N.isNight(); } catch (e) {}
    return !mq || mq.matches;
  }
  function isDark() { return prefs.mode === 'dark' ? true : prefs.mode === 'light' ? false : systemDark(); }

  /* the colours in use right now: chosen theme, optionally with wallpaper (Material You) roles on top */
  function current(forceDark) {
    var dark = forceDark == null ? isDark() : !!forceDark;
    var t = THEMES[dark ? prefs.dark : prefs.light];
    var c = Object.assign({}, t.c);
    var dynOn = !!(prefs.dyn && dyn && dyn[dark ? 'dark' : 'light']);
    if (dynOn) Object.assign(c, dyn[dark ? 'dark' : 'light']);
    return { id: t.id, name: dynOn ? 'Wallpaper' : t.name, dark: dark, dyn: dynOn, c: c, ev: t.ev.slice() };
  }

  var aliases = {};
  var listeners = [];
  function apply() {
    var cur = current(), st = document.documentElement.style;
    TOKENS.forEach(function (k) { st.setProperty('--' + k, cur.c[k]); });
    Object.keys(aliases).forEach(function (name) {
      var a = aliases[name], v = typeof a === 'function' ? a(cur.c, cur) : cur.c[a];
      if (v != null) st.setProperty(name, v);
    });
    if (cur.dark) document.documentElement.removeAttribute('data-light'); else document.documentElement.setAttribute('data-light', '');
    st.colorScheme = cur.dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', cur.c.bg);
    if (N) {
      try { N.setChrome(cur.c.bg, cur.dark); } catch (e) {}
      try {
        var pack = function (d) { var x = current(d); return Object.assign({ ev: x.ev, name: x.name }, x.c); };
        N.saveColors(JSON.stringify({ mode: prefs.mode, dyn: !!prefs.dyn, light: pack(false), dark: pack(true) }));
      } catch (e) {}
    }
    listeners.forEach(function (fn) { try { fn(cur); } catch (e) {} });
    return cur;
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (prefs.mode === 'system') apply(); });

  /* ---------- icons: 24 px grid, 2 px round strokes ---------- */
  var IC = {
    back: 'M20 12H5M11 6l-6 6 6 6', close: 'M7 7l10 10M17 7L7 17', check: 'M5 12.5l4.5 4.5L19 7',
    plus: 'M12 5v14M5 12h14', more: 'M12 5h.01M12 12h.01M12 19h.01', search: 'M4 11a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M20 20l-4.2-4.2',
    tune: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    share: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6', edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4', undo: 'M9 14l-5-5 5-5M4 9h11a5 5 0 0 1 0 10h-3',
    info: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 11v5M12 8h.01', warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
    lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4', shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4',
    palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 21 9.7C21 5.9 17 3 12 3zM7.5 12h.01M9.5 8h.01M14.5 8h.01',
    sun: 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', phone: 'M7 3h10v18H7zM11 18h2',
    widget: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', bug: 'M8 9h8v7a4 4 0 0 1-8 0zM9 5l1.5 2M15 5l-1.5 2M4 13h4M16 13h4M5 19l3-2M19 19l-3-2',
    download: 'M12 3v12M7 10l5 5 5-5M5 14v6h14v-6', upload: 'M12 15V3M7 8l5-5 5 5M5 14v6h14v-6', restore: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5',
    chevR: 'M9 5l7 7-7 7', chevD: 'M6 9l6 6 6-6', folder: 'M3 6h6l2 2h10v11H3z',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', clock: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 7v5l3 2', image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01', file: 'M6 3h9l4 4v14H6zM14 3v5h5', star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z'
  };
  function icon(name, cls) { return '<svg class="k-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (IC[name] || name) + '"/></svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- the shared Appearance section ----------
     Kit.appearanceHtml() returns markup built from kit classes; Kit.bindAppearance(el, after) wires it.
     Every app shows the same controls in the same order. */
  function seg(name, opts, val) {
    return '<div class="k-seg" role="radiogroup" aria-label="' + esc(name) + '">' + opts.map(function (o) {
      var on = o[0] === val;
      return '<button type="button" role="radio" aria-checked="' + on + '" data-kit="mode" data-v="' + o[0] + '">' + (on ? icon('check') : '') + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function picker(kind) {
    var key = kind === 'dark' ? 'dark' : 'light';
    return '<div class="k-tpick" role="radiogroup" aria-label="' + (kind === 'dark' ? 'Dark theme' : 'Light theme') + '">' + IDS.filter(function (id) { return THEMES[id].dark === (kind === 'dark'); }).map(function (id) {
      var t = THEMES[id], on = prefs[key] === id;
      return '<button type="button" class="k-tcard" role="radio" aria-checked="' + on + '" data-kit="theme" data-k="' + key + '" data-v="' + id + '" style="--tb:' + t.c.bg + ';--tc:' + t.c.cont + ';--tl:' + t.c.high + ';--ta:' + t.c.pri + '">' +
        '<span class="k-pv"><i class="h"></i><i></i><i class="s"></i><i class="f"></i>' + (on ? '<span class="k-ck">' + icon('check') + '</span>' : '') + '</span>' + esc(t.name) + '</button>';
    }).join('') + '</div>';
  }
  function appearanceHtml() {
    var h = '<div class="k-cap pri">Appearance</div><div class="k-group">';
    h += '<div class="k-row k-col"><div class="k-rt"><span class="k-t">Theme</span></div>' + seg('Theme', [['light', 'Light'], ['system', 'Follow phone'], ['dark', 'Dark']], prefs.mode) + '</div>';
    if (dyn) h += '<button type="button" class="k-row" role="switch" aria-checked="' + !!prefs.dyn + '" data-kit="dyn">' + icon('palette') + '<span class="k-rt"><span class="k-t">Wallpaper colours</span><small>Material You colours from your Pixel’s wallpaper</small></span><span class="k-switch' + (prefs.dyn ? ' on' : '') + '"></span></button>';
    if (prefs.mode !== 'dark') h += '<div class="k-row k-col"><div class="k-rt"><span class="k-t">Light theme</span>' + (prefs.dyn && dyn ? '<small>Wallpaper colours are on; the theme sets the category colours</small>' : '') + '</div>' + picker('light') + '</div>';
    if (prefs.mode !== 'light') h += '<div class="k-row k-col"><div class="k-rt"><span class="k-t">Dark theme</span></div>' + picker('dark') + '</div>';
    return h + '</div>';
  }
  function bindAppearance(el, after) {
    if (!el || el.__kitBound) return;
    el.__kitBound = true;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kit]');
      if (!b || !el.contains(b)) return;
      var a = b.getAttribute('data-kit');
      if (a === 'mode') prefs.mode = b.getAttribute('data-v');
      else if (a === 'dyn') prefs.dyn = !prefs.dyn;
      else if (a === 'theme') prefs[b.getAttribute('data-k')] = b.getAttribute('data-v');
      else return;
      savePrefs(); haptic('tick'); apply();
      if (after) after(); else el.innerHTML = appearanceHtml();
    });
  }

  /* ---------- system: insets, back, haptics ---------- */
  var insets = { top: 0, bottom: 0, left: 0, right: 0, ime: 0 };
  var insetListeners = [];
  function setInsets(t, b, l, r, ime) {
    insets = { top: +t || 0, bottom: +b || 0, left: +l || 0, right: +r || 0, ime: +ime || 0 };
    var st = document.documentElement.style;
    st.setProperty('--kit-top', insets.top + 'px');
    st.setProperty('--kit-bottom', (insets.ime ? 0 : insets.bottom) + 'px');
    st.setProperty('--kit-left', insets.left + 'px');
    st.setProperty('--kit-right', insets.right + 'px');
    st.setProperty('--kit-ime', insets.ime + 'px');
    if (insets.ime > 0) document.documentElement.setAttribute('data-ime', ''); else document.documentElement.removeAttribute('data-ime');
    insetListeners.forEach(function (fn) { try { fn(insets); } catch (e) {} });
  }

  /* Back: the app registers a handler (returns true when it closed something) and a check
     (true while there is something to close). Kit keeps Android's predictive-back callback
     registered only while the check is true, so "back to home" plays the system animation. */
  var backFn = null, canFn = null, lastCan = null, syncT = null;
  function onBack(handler, can) { backFn = handler; canFn = can; syncBack(); }
  function syncBack() {
    clearTimeout(syncT);
    syncT = setTimeout(function () {
      var can = false;
      try { can = !!(canFn && canFn()); } catch (e) { can = false; }
      if (can !== lastCan) { lastCan = can; try { if (N && N.setCanGoBack) N.setCanGoBack(can); } catch (e) {} }
    }, 30);
  }
  function nativeBack() {
    var r = false;
    try { r = !!(backFn && backFn()); } catch (e) { r = false; }
    syncBack();
    return r;
  }
  if (typeof MutationObserver !== 'undefined') {
    var started = function () { new MutationObserver(syncBack).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current', 'hidden'] }); };
    if (document.body) started(); else document.addEventListener('DOMContentLoaded', started);
  }

  var progressFns = [];
  function progress(p, edge) { progressFns.forEach(function (fn) { try { fn(p, edge); } catch (e) {} }); }

  function haptic(kind) { try { if (N && N.haptic) N.haptic(kind || 'tick'); else if (navigator.vibrate) navigator.vibrate(6); } catch (e) {} }

  root.Kit = {
    VERSION: VERSION, TOKENS: TOKENS, THEMES: THEMES, IDS: IDS,
    prefs: function () { return Object.assign({}, prefs); },
    setPrefs: function (p) { Object.assign(prefs, p || {}); savePrefs(); return apply(); },
    current: current, apply: apply, isDark: isDark, hasDynamic: function () { return !!dyn; },
    alias: function (map) { Object.assign(aliases, map); },
    onTheme: function (fn) { listeners.push(fn); },
    appearanceHtml: appearanceHtml, bindAppearance: bindAppearance,
    icon: icon, IC: IC, esc: esc, haptic: haptic,
    insets: function () { return insets; }, onInsets: function (fn) { insetListeners.push(fn); fn(insets); },
    onBack: onBack, syncBack: syncBack, onBackProgress: function (fn) { progressFns.push(fn); },
    native: N,
    _insets: setInsets, _back: nativeBack, _progress: progress, _night: function () { if (prefs.mode === 'system') apply(); }
  };
})(this);
