/* Margin — interface. Built on the shared kit (kit/kit.js, kit/kit.css), the same look as the rest
   of the suite. Talks to Android through window.Native (Bridge.java); reading logic lives in
   logic.js and the reading surface in reader.js. */
(function () {
  'use strict';
  var L = window.Logic, N = window.Native || null;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = Kit.esc;

  // ---------------------------------------------------------------- icons (kit set + a few of our own)
  var P = {
    book: 'M12 6.5C10 5 7.5 4.5 4 4.8v13c3.5-.3 6 .2 8 1.7M12 6.5c2-1.5 4.5-2 8-1.7v13c-3.5-.3-6 .2-8 1.7M12 6.5v13',
    toc: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    aa: 'M3 18l5-12 5 12M4.6 14h6.8M14 18l3.5-8.5L21 18M15 15.5h5',
    bookmark: 'M7 3h10v18l-5-4-5 4z',
    note: 'M5 4h14v12l-4 4H5zM15 20v-4h4M8 9h8M8 13h5',
    highlight: 'M15 4l5 5-9 9H6v-5zM4 21h7',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    speak: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11',
    define: 'M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-4M20 9h-4M20 13h-3',
    daybook: 'M5 4h14v16H5zM9 2v4M15 2v4M8 11h8M8 15h5',
    library: 'M4 4h4v16H4zM10 4h4v16h-4zM16 5l4-1 2.5 15.5-4 .8z',
    shelf: 'M4 19h16M6 19V8h3v11M10 19V5h3v14M14.5 19l2.5-11 3 .7-2.5 11',
    play: 'M8 5v14l11-7z', pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
    stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    cards: 'M7 4h13v13H7zM4 7v13h13',
    people: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7M2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c2.4.6 4 2.8 4 6',
    recap: 'M4 6h16M4 10h16M4 14h10M4 18h7',
    nonet: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M5.6 5.6l12.8 12.8',
    sepia: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 3v18',
    scroll: 'M8 4v16M8 4l-3 3M8 4l3 3M16 20V4M16 20l-3-3M16 20l3-3',
    pages: 'M4 5h7v14H4zM13 5h7v14h-7z',
    zoom: 'M4 11a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M20 20l-4.2-4.2M8 11h6M11 8v6',
    text: 'M4 6h16M4 10h16M4 14h16M4 18h10',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
    timer: 'M12 8v5l3 2M9 2h6M12 21a8 8 0 1 0 0-16a8 8 0 0 0 0 16z',
    skipf: 'M5 5v14l9-7zM15 5v14M19 5v14', skipb: 'M19 5v14l-9-7zM9 5v14M5 5v14',
    export: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6',
    folderPlus: 'M3 6h6l2 2h10v11H3zM12 11v6M9 14h6',
  };
  function ic(name, cls) { return Kit.icon(P[name] || name, cls); }
  var BOOK_ICON = '<svg viewBox="0 0 108 108" aria-hidden="true"><rect width="108" height="108" rx="28" fill="#fb4934"/><path d="M54 40c-7 -5 -15 -7 -24 -6v38c9 -1 17 1 24 6M54 40c7 -5 15 -7 24 -6v38c-9 -1 -17 1 -24 6M54 40v38" fill="none" stroke="#1d2021" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M64 36v15l4 -3l4 3v-16" fill="none" stroke="#1d2021" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var HL_COLORS = { yellow: ['#f5c842', 'rgba(245,200,66,.42)'], green: ['#8ec07c', 'rgba(142,192,124,.42)'], blue: ['#7fa7d9', 'rgba(127,167,217,.42)'], pink: ['#e98aa6', 'rgba(233,138,166,.42)'] };
  var HL_DARK = { yellow: 'rgba(245,200,66,.30)', green: 'rgba(142,192,124,.30)', blue: 'rgba(127,167,217,.32)', pink: 'rgba(233,138,166,.30)' };
  var SEPIA = { bg: '#f3e9d2', ink: '#4a3a27', muted: '#8b7558', link: '#9a4b1c', deep: '#e6d9bd', low: '#eadfc4' };

  // ---------------------------------------------------------------- state
  var S = {
    nav: [{ s: 'library' }],
    books: [], byId: {}, loaded: false, status: {},
    filter: 'reading', query: '', searching: false,
    sheet: null, modal: null, snack: null, pop: null, sel: null,
    reader: null, scrolls: {},
  };
  function top() { return S.nav[S.nav.length - 1]; }
  var plural = L.plural;

  // ---------------------------------------------------------------- native calls
  var waiting = {}, tokenN = 0;
  function call(fn, args) {
    return new Promise(function (resolve) {
      if (!N || !N[fn]) { resolve({ ok: false, error: 'unavailable' }); return; }
      var t = 't' + (++tokenN);
      waiting[t] = resolve;
      try { N[fn].apply(N, (args || []).concat([t])); } catch (e) { delete waiting[t]; resolve({ ok: false, error: String(e) }); }
    });
  }
  function nat(fn) { try { return N && N[fn] ? N[fn].apply(N, [].slice.call(arguments, 1)) : undefined; } catch (e) { return undefined; } }
  var haptic = Kit.haptic;
  function copy(t) { try { if (window.KitNative) window.KitNative.copy(t); else if (navigator.clipboard) navigator.clipboard.writeText(t); } catch (e) {} }

  // ---------------------------------------------------------------- documents (saved as JSON by Native.save)
  var docs = {}, dirty = {}, saveT = null;
  function doc(key, def) {
    if (docs[key]) return docs[key];
    var v = null;
    try { v = JSON.parse(nat('load', key) || 'null'); } catch (e) { v = null; }
    if (!v || typeof v !== 'object') v = def ? JSON.parse(JSON.stringify(def)) : {};
    else if (def) Object.keys(def).forEach(function (k) { if (v[k] === undefined) v[k] = JSON.parse(JSON.stringify(def[k])); });
    docs[key] = v;
    return v;
  }
  function touch(key) { dirty[key] = 1; clearTimeout(saveT); saveT = setTimeout(flush, 600); }
  function flush() {
    clearTimeout(saveT);
    Object.keys(dirty).forEach(function (k) { if (docs[k]) nat('save', k, JSON.stringify(docs[k])); });
    dirty = {};
  }
  var DEF_SETTINGS = { mode: 'paged', font: 'literata', size: 19, line: 1.55, margin: 24, justify: true, hyphens: true, paper: 'app', volumeKeys: true, footer: 'chapter', goal: 20, digest: false, recap: true, sleep: 0 };
  function settings() { return doc('settings', DEF_SETTINGS); }
  function lib() { return doc('library', { collections: [], hidden: {}, last: '', added: {} }); }
  function bookDoc(id) { return doc('b-' + id, { pos: null, frac: 0, opened: 0, started: 0, finished: 0, shelf: '', collections: [], hl: [], bm: [], lens: null, words: 0, chapters: 0 }); }

  // ---------------------------------------------------------------- snackbar and dialogs
  var snackT;
  function snack(msg, undo) {
    S.snack = { msg: msg, undo: undo || null };
    clearTimeout(snackT);
    snackT = setTimeout(function () { S.snack = null; renderOverlay(); }, undo ? 5000 : 3200);
    renderOverlay();
  }
  function confirmBox(o) { S.modal = o; renderOverlay(); }

  // ---------------------------------------------------------------- library data
  var loading = false;
  function refreshStatus() { try { S.status = JSON.parse(nat('status') || '{}'); } catch (e) { S.status = {}; } }
  function loadLibrary() {
    if (loading) return Promise.resolve();
    loading = true;
    return call('library').then(function (r) {
      loading = false;
      var hidden = lib().hidden || {};
      S.books = (r && r.books || []).filter(function (b) { return !hidden[b.id]; }).map(function (b) {
        var m = b.meta || {};
        return { id: b.id, format: b.format, path: b.path, name: b.name, size: b.size, mtime: b.mtime, title: m.title || b.name, author: m.author || '', series: m.series || '', seriesIndex: m.seriesIndex || 0, lang: m.language || '', cover: !!m.cover || b.format === 'pdf' || b.format === 'cbz', broken: !!m.broken };
      });
      S.byId = {};
      S.books.forEach(function (b) { S.byId[b.id] = b; if (!lib().added[b.id]) { lib().added[b.id] = Date.now(); touch('library'); } });
      S.loaded = true;
      if (top().s === 'library') render();
    });
  }

  function shelfOf(b) {
    var d = bookDoc(b.id);
    if (d.shelf) return d.shelf;
    if (d.finished) return 'finished';
    if (d.opened) return 'reading';
    return 'toread';
  }
  function progressOf(b) { var d = bookDoc(b.id); return d.finished ? 1 : (d.frac || 0); }
  function byTitle(a, b) { return a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }); }
  function bySeries(a, b) {
    return (a.author || '~').localeCompare(b.author || '~') || (a.series || '~').localeCompare(b.series || '~') || (a.seriesIndex - b.seriesIndex) || byTitle(a, b);
  }

  // ---------------------------------------------------------------- back
  function back() {
    if (S.pop) { S.pop = null; renderOverlay(); return true; }
    if (S.modal) { S.modal = null; renderOverlay(); return true; }
    if (S.sheet) { closeSheet(); return true; }
    if (S.sel) { clearSel(); return true; }
    if (top().s === 'library' && S.searching) { S.searching = false; S.query = ''; render(); return true; }
    if (S.nav.length > 1) { leave(); S.nav.pop(); render(); return true; }
    return false;
  }
  function canBack() { return !!(S.pop || S.modal || S.sheet || S.sel || S.nav.length > 1 || S.searching); }
  Kit.onBack(back, canBack);

  function go(screen, extra) { saveScroll(); leave(); S.nav.push(Object.assign({ s: screen }, extra || {})); render(); }
  function leave() { if (top().s === 'reader') closeReader(); }

  var app = window.app = {
    back: back,
    onNative: function (ev) {
      switch (ev.type) {
        case 'resume': refreshStatus(); loadLibrary(); if (S.reader) S.reader.resumed(); break;
        case 'pause': flush(); if (S.reader) S.reader.paused(); break;
        case 'launch': handleLaunch(); break;
        case 'key': if (S.reader) { if (ev.dir > 0) S.reader.next(); else S.reader.prev(); } break;
        default:
          if (ev.token && waiting[ev.token]) { var f = waiting[ev.token]; delete waiting[ev.token]; f(ev); }
          else if (app.extra[ev.type]) app.extra[ev.type](ev);
      }
    },
    extra: {},
    state: S,
  };

  function handleLaunch() {
    var l = nat('takeLaunch');
    if (!l) return;
    var o; try { o = JSON.parse(l); } catch (e) { return; }
    if (o.open === 'book') {
      if (o.error && !(o.ids && o.ids.length)) { snack(o.error); return; }
      loadLibrary().then(function () { if (o.ids && o.ids[0]) openBook(o.ids[0]); });
    } else if (o.open === 'continue') {
      var id = o.id || lib().last;
      if (id) loadLibrary().then(function () { if (S.byId[id]) openBook(id); });
    } else if (o.open && app.launchers[o.open]) app.launchers[o.open](o);
  }
  app.launchers = {};

  // ---------------------------------------------------------------- shared pieces
  function header(t, sub, actions) {
    return '<header class="k-head"><div class="k-ht"><h1>' + esc(t) + '</h1>' + (sub ? '<div class="k-hs">' + esc(sub) + '</div>' : '') + '</div><div class="acts">' + (actions || '') + '</div></header>';
  }
  function subHeader(t, sub, actions) {
    return '<header class="k-head k-small"><button type="button" class="k-icb" data-a="back" aria-label="Back">' + Kit.icon('back') + '</button><div class="k-ht"><h1>' + esc(t) + '</h1>' + (sub ? '<div class="k-hs">' + esc(sub) + '</div>' : '') + '</div><div class="acts">' + (actions || '') + '</div></header>';
  }
  function icb(a, icon, label, extra) { return '<button type="button" class="k-icb" data-a="' + a + '"' + (extra || '') + ' aria-label="' + esc(label) + '">' + icon + '</button>'; }
  function capRow(t, right) { return '<div class="k-cap pri"><span>' + esc(t) + '</span><span class="k-sp"></span>' + (right ? '<span class="k-n">' + esc(right) + '</span>' : '') + '</div>'; }
  function row(o) {
    var tag = o.a ? 'button type="button" data-a="' + o.a + '"' + (o.attrs || '') : 'div';
    return '<' + tag + ' class="k-row' + (o.cls ? ' ' + o.cls : '') + '">' +
      (o.lead ? '<span class="k-lead">' + o.lead + '</span>' : o.icon ? o.icon : '') +
      '<span class="k-rt"><span class="k-t">' + esc(o.t) + '</span>' + (o.sub != null && o.sub !== '' ? '<small>' + esc(o.sub) + '</small>' : '') + '</span>' +
      (o.val ? '<span class="k-val">' + esc(o.val) + '</span>' : '') + (o.btn || '') + (o.chev ? Kit.icon('chevR', 'k-chev') : '') +
      '</' + (o.a ? 'button' : 'div') + '>';
  }
  function sw(on, a, label, extra) { return '<button type="button" class="k-switch' + (on ? ' on' : '') + '" role="switch" aria-checked="' + !!on + '" data-a="' + a + '"' + (extra || '') + ' aria-label="' + esc(label) + '"></button>'; }
  function seg(label, opts, val, a) {
    return '<div class="k-seg" role="radiogroup" aria-label="' + esc(label) + '">' + opts.map(function (o) {
      var on = String(o[0]) === String(val);
      return '<button type="button" role="radio" aria-checked="' + on + '" data-a="' + a + '" data-v="' + esc(o[0]) + '">' + (on ? Kit.icon('check') : '') + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function hue(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function coverHtml(b, opt) {
    opt = opt || {};
    var cur = Kit.current(), ev = cur.ev, col = ev[hue(b.title + b.author) % ev.length];
    var gen = '<div class="gen" style="background:' + col + '"><b>' + esc(b.title) + '</b>' + (b.author ? '<i>' + esc(b.author) + '</i>' : '') + '</div>';
    var img = b.cover ? '<img alt="" loading="lazy" decoding="async" src="/cover/' + b.id + '">' : '';
    var p = opt.progress != null ? opt.progress : null;
    return '<div class="cv">' + gen + img + (b.format !== 'epub' ? '<span class="fmt">' + esc(b.format.toUpperCase()) + '</span>' : '') +
      (p === 1 ? '<span class="done">' + Kit.icon('check') + '</span>' : p ? '<span class="prog"><i style="width:' + Math.round(p * 100) + '%"></i></span>' : '') + '</div>';
  }
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function pct(f) { return Math.round((f || 0) * 100) + '%'; }
  function ago(ms) {
    if (!ms) return '';
    var d = (Date.now() - ms) / 864e5;
    if (d < 1 && new Date(ms).getDate() === new Date().getDate()) return 'today';
    if (d < 2) return 'yesterday';
    if (d < 7) return Math.floor(d) + ' days ago';
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  // ---------------------------------------------------------------- render
  function saveScroll() { var sc = document.querySelector('.scroll[data-k], .pscroll[data-k]'); if (sc) S.scrolls[sc.dataset.k] = sc.scrollTop; }
  var views = {};
  function render() {
    saveScroll();
    var t = top(), s = t.s, v = views[s] || views.library;
    if (s === 'reader') {
      if (!S.reader && S.byId[t.id]) S.reader = new ReaderUI(S.byId[t.id], null);
      if (S.reader) {
        if (S.reader.mounted) S.reader.renderChrome(); else S.reader.mount();
        renderOverlay(); Kit.syncBack(); return;
      }
      S.nav.pop(); t = top(); s = t.s; v = views[s] || views.library;
    }
    $('#app').innerHTML = '<div class="screen s-' + s + '" data-screen="' + s + '">' + v.html(t) + '</div>';
    var sc = document.querySelector('.scroll[data-k], .pscroll[data-k]');
    if (sc && S.scrolls[sc.dataset.k] != null) sc.scrollTop = S.scrolls[sc.dataset.k];
    if (v.after) v.after(t);
    renderOverlay();
    Kit.syncBack();
  }
  app.render = render;

  // ================================================================ library
  views.library = {
    html: function () {
      var books = S.books, h = '';
      var reading = books.filter(function (b) { return shelfOf(b) === 'reading'; });
      var sub = !S.loaded ? 'Looking for books…' : books.length ? plural(books.length, 'book') + (reading.length ? ' · ' + reading.length + ' reading' : '') : 'No books yet';
      if (S.searching) {
        h += '<header class="k-head k-small"><button type="button" class="k-icb" data-a="back" aria-label="Close search">' + Kit.icon('back') + '</button><div class="k-ht"><input id="q" class="k-field" type="search" placeholder="Title, author or series" value="' + esc(S.query) + '" autocomplete="off" enterkeyhint="search"></div></header>';
      } else {
        h += header('Library', sub, icb('search', Kit.icon('search'), 'Search books') + icb('importBooks', Kit.icon('plus'), 'Add books') + icb('go', Kit.icon('tune'), 'Settings', ' data-to="settings"'));
      }
      h += '<div class="scroll" data-k="library" id="sc">';
      if (!books.length) return h + emptyLibrary() + '</div>';
      var cols = lib().collections || [];
      if (!S.searching) {
        var counts = { reading: 0, toread: 0, finished: 0 };
        books.forEach(function (b) { counts[shelfOf(b)]++; });
        var chips = [['reading', 'Reading', counts.reading], ['toread', 'To read', counts.toread], ['finished', 'Finished', counts.finished], ['all', 'All', books.length]];
        var nSeries = {};
        books.forEach(function (b) { if (b.series) nSeries[b.series] = 1; });
        if (Object.keys(nSeries).length) chips.push(['series', 'Series', Object.keys(nSeries).length]);
        cols.forEach(function (c) { chips.push(['c:' + c, c, books.filter(function (b) { return bookDoc(b.id).collections.indexOf(c) >= 0; }).length]); });
        h += '<div class="k-chips" role="tablist">' + chips.map(function (c) {
          var on = S.filter === c[0];
          return '<button type="button" class="k-chip" role="tab" aria-pressed="' + on + '" data-a="filter" data-v="' + esc(c[0]) + '">' + (on ? Kit.icon('check') : '') + esc(c[1]) + ' <span class="k-mono k-muted" style="font-size:12px">' + c[2] + '</span></button>';
        }).join('') + '<button type="button" class="k-chip" data-a="newCollection" aria-label="New collection">' + Kit.icon('plus') + '</button></div>';
        if (!S.status.allFiles && S.loaded) h += '<div style="margin:8px 0 4px">' + '<div class="k-note">' + Kit.icon('folder') + '<span style="flex:1">Let Margin look in your Books and Download folders to find books by itself.</span></div><div style="display:flex;justify-content:flex-end;margin:4px 16px 0"><button type="button" class="k-btn sm" data-a="allFiles">Allow</button></div></div>';
        var cont = continueBook();
        if (cont && (S.filter === 'reading' || S.filter === 'all')) h += heroHtml(cont);
      }
      h += '<div id="libres">' + libResults() + '</div>';
      return h + '<div class="pad-b"></div></div>';
    },
    after: function () {
      var q = $('#q');
      if (q) {
        q.addEventListener('input', function () { S.query = q.value; var r = $('#libres'); if (r) r.innerHTML = libResults(); });
        q.addEventListener('keydown', function (e) { if (e.key === 'Enter') q.blur(); });
        if (!S.query) setTimeout(function () { q.focus(); }, 50);
      }
    },
  };

  function libResults() {
    var list = filtered(), h = '';
    if (!list.length) {
      return '<div class="k-empty"><b>' + (S.searching ? 'No matches' : S.filter === 'finished' ? 'Nothing finished yet' : S.filter === 'reading' ? 'Not reading anything' : 'Empty shelf') + '</b>' +
        (S.searching ? 'Try a title, an author or a series.' : S.filter === 'reading' ? 'Open a book from <i>To read</i> or <i>All</i> and it shows up here.' : S.filter.indexOf('c:') === 0 ? 'Add books to this collection from a book’s menu (long-press a cover).' : S.filter === 'finished' ? 'Books you finish show up here.' : 'Nothing here yet.') + '</div>';
    }
    var lastSeries = null, grid = '', showSeries = S.filter === 'series' && !S.searching;
    list.forEach(function (b) {
      if (showSeries && (b.series || null) !== lastSeries) {
        if (grid) h += '<div class="shelf">' + grid + '</div>';
        grid = '';
        h += '<div class="series-h">' + esc(b.series) + '</div>';
      }
      lastSeries = showSeries ? b.series || null : null;
      var d = bookDoc(b.id), p = progressOf(b);
      var meta = d.finished ? 'Finished ' + ago(d.finished) : d.opened ? pct(p) + ' · ' + ago(d.opened) : b.series ? b.series + (b.seriesIndex ? ' ' + b.seriesIndex : '') : b.format.toUpperCase() + ' · ' + fmtSize(b.size);
      grid += '<button type="button" class="bk" data-a="open" data-lp="book" data-id="' + b.id + '" aria-label="' + esc(b.title + (b.author ? ', ' + b.author : '') + ', ' + meta) + '">' + coverHtml(b, { progress: d.opened ? p : null }) +
        '<span class="t">' + esc(b.title) + '</span>' + (b.author ? '<span class="a">' + esc(b.author) + '</span>' : '') + '<span class="pr">' + esc(meta) + '</span></button>';
    });
    return h + '<div class="shelf">' + grid + '</div>';
  }

  function emptyLibrary() {
    var st = S.status;
    return '<div class="k-empty" style="margin-top:32px"><div class="empty-art">' + ic('book') + '</div><b>' + (S.loaded ? 'No books yet' : 'Looking for books…') + '</b>' +
      (st.allFiles ? 'Margin looks in ' + esc((st.folders || []).map(function (f) { return f.split('/').pop(); }).join(' and ') || 'your folders') + ' for EPUB, PDF, text and Markdown books. Put some there, or add them here.' :
        'Margin can find EPUB, PDF, text and Markdown books in your Books and Download folders, or you can add books one by one.') +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">' + (st.allFiles ? '' : '<button type="button" class="k-btn filled" data-a="allFiles">' + Kit.icon('folder') + 'Find books in my folders</button>') +
      '<button type="button" class="k-btn ' + (st.allFiles ? 'filled' : 'tonal') + '" data-a="importBooks">' + Kit.icon('plus') + 'Add books</button></div></div>';
  }

  function continueBook() {
    var best = null, bt = 0;
    S.books.forEach(function (b) { var d = bookDoc(b.id); if (d.opened > bt && !d.finished && shelfOf(b) === 'reading') { bt = d.opened; best = b; } });
    return best;
  }
  function heroHtml(b) {
    var d = bookDoc(b.id), p = progressOf(b), left = timeLeftBook(b);
    return '<button type="button" class="hero" data-a="open" data-lp="book" data-id="' + b.id + '">' + coverHtml(b) + '<span class="hx"><span class="lab">Continue reading</span><span class="t">' + esc(b.title) + '</span>' +
      (b.author ? '<span class="a">' + esc(b.author) + '</span>' : '') + '<span class="m"><span>' + pct(p) + '</span>' + (left ? '<span>· ' + esc(left) + ' left</span>' : '') + '<span>· ' + esc(ago(d.opened)) + '</span></span>' +
      '<span class="bar"><i style="width:' + Math.round(p * 100) + '%"></i></span></span></button>';
  }
  function filtered() {
    var q = S.query.trim().toLowerCase(), list = S.books.slice();
    if (S.searching) {
      if (!q) return list.sort(byTitle);
      var words = q.split(/\s+/);
      return list.filter(function (b) {
        var hay = (b.title + ' ' + b.author + ' ' + b.series + ' ' + b.name).toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) >= 0; });
      }).sort(byTitle);
    }
    var f = S.filter;
    if (f === 'all') return list.sort(byTitle);
    if (f === 'series') return list.filter(function (b) { return b.series; }).sort(function (a, b) { return a.series.localeCompare(b.series) || (a.seriesIndex - b.seriesIndex) || byTitle(a, b); });
    if (f.indexOf('c:') === 0) { var c = f.slice(2); return list.filter(function (b) { return bookDoc(b.id).collections.indexOf(c) >= 0; }).sort(bySeries); }
    list = list.filter(function (b) { return shelfOf(b) === f; });
    if (f === 'reading') return list.sort(function (a, b) { return bookDoc(b.id).opened - bookDoc(a.id).opened; });
    if (f === 'finished') return list.sort(function (a, b) { return bookDoc(b.id).finished - bookDoc(a.id).finished; });
    return list.sort(function (a, b) { return (lib().added[b.id] || 0) - (lib().added[a.id] || 0) || byTitle(a, b); });
  }

  // Long-press (or right-click) on anything with data-lp opens its menu.
  var lpT = null, lpX = 0, lpY = 0, lpFired = false;
  document.addEventListener('touchstart', function (e) {
    var el = e.target.closest && e.target.closest('[data-lp]');
    lpFired = false;
    if (!el || e.touches.length !== 1) return;
    lpX = e.touches[0].clientX; lpY = e.touches[0].clientY;
    lpT = setTimeout(function () { lpFired = true; haptic('long'); longPressed(el); }, 450);
  }, { passive: true });
  document.addEventListener('touchmove', function (e) { if (lpT && (Math.abs(e.touches[0].clientX - lpX) > 8 || Math.abs(e.touches[0].clientY - lpY) > 8)) { clearTimeout(lpT); lpT = null; } }, { passive: true });
  document.addEventListener('touchend', function (e) { clearTimeout(lpT); lpT = null; if (lpFired) { e.preventDefault(); lpFired = false; } });
  document.addEventListener('contextmenu', function (e) { var el = e.target.closest && e.target.closest('[data-lp]'); if (el) { e.preventDefault(); if (!lpFired) longPressed(el); } });
  function longPressed(el) { if (el.dataset.lp === 'book') bookSheet(el.dataset.id); else if (app.longPress[el.dataset.lp]) app.longPress[el.dataset.lp](el); }
  app.longPress = {};

  // ---------------------------------------------------------------- book sheet (long-press a cover)
  function bookSheet(id) {
    var b = S.byId[id];
    if (!b) return;
    S.sheet = { kind: 'book', id: id };
    renderOverlay();
  }
  function bookSheetHtml(sh) {
    var b = S.byId[sh.id];
    if (!b) return '';
    var d = bookDoc(b.id), shelf = shelfOf(b), cols = lib().collections || [];
    var h = '<div style="display:flex;gap:16px;align-items:flex-start;margin:4px 4px 16px"><div style="width:76px;flex:none">' + coverHtml(b) + '</div><div style="min-width:0;flex:1"><h3 style="margin:0 0 4px">' + esc(b.title) + '</h3>' +
      (b.author ? '<div class="k-muted" style="font-size:14px">' + esc(b.author) + '</div>' : '') +
      (b.series ? '<div class="k-muted" style="font-size:13px;margin-top:2px">' + esc(b.series) + (b.seriesIndex ? ' · ' + esc(b.seriesIndex) : '') + '</div>' : '') +
      '<div class="k-mono k-muted" style="font-size:12px;margin-top:6px">' + esc(b.format.toUpperCase()) + ' · ' + fmtSize(b.size) + (d.opened ? ' · ' + pct(progressOf(b)) : '') + '</div></div></div>';
    h += '<div style="display:flex;gap:8px;margin-bottom:12px"><button type="button" class="k-btn filled" style="flex:1" data-a="open" data-id="' + b.id + '">' + ic('book') + (d.opened && !d.finished ? 'Continue' : d.finished ? 'Read again' : 'Start reading') + '</button>' +
      (d.hl.length || d.bm.length ? '<button type="button" class="k-btn tonal" data-a="notebook" data-id="' + b.id + '">' + ic('note') + 'Notes</button>' : '') + '</div>';
    h += '<div class="k-group">' + '<div class="k-row k-col"><div class="k-rt"><span class="k-t">Shelf</span></div>' + seg('Shelf', [['toread', 'To read'], ['reading', 'Reading'], ['finished', 'Finished']], shelf, 'setShelf" data-id="' + b.id) + '</div>';
    h += '<div class="k-row k-col"><div class="k-rt"><span class="k-t">Collections</span>' + (cols.length ? '' : '<small>Group books your own way, like “Swedish” or “Book club”</small>') + '</div><div class="k-chips" style="padding:0">' +
      cols.map(function (c) { var on = d.collections.indexOf(c) >= 0; return '<button type="button" class="k-chip" aria-pressed="' + on + '" data-a="toggleCol" data-id="' + b.id + '" data-v="' + esc(c) + '">' + (on ? Kit.icon('check') : '') + esc(c) + '</button>'; }).join('') +
      '<button type="button" class="k-chip" data-a="newCollection" data-id="' + b.id + '">' + Kit.icon('plus') + 'New</button></div></div>';
    h += row({ icon: Kit.icon('file'), t: b.name, sub: b.path.replace(/^\/storage\/emulated\/0\//, '').replace(/^\/data\/.*\/imported\//, 'Margin › ') });
    h += row({ a: 'hideBook', attrs: ' data-id="' + b.id + '"', icon: Kit.icon('trash'), t: 'Remove from library', sub: 'The file stays where it is; your notes are kept' }) + '</div>';
    return h;
  }

  // ================================================================ reader

  function readerColors() {
    var st = settings(), cur = Kit.current(), c = cur.c, dark = cur.dark;
    if (st.paper === 'sepia') return { bg: SEPIA.bg, ink: SEPIA.ink, muted: SEPIA.muted, link: SEPIA.link, deep: SEPIA.deep, low: SEPIA.low, dark: false, pri: '#a8432f' };
    return { bg: c.bg, ink: c.ink, muted: c.muted, link: c.pri, deep: c.cont, low: c.low, dark: dark, pri: c.pri };
  }
  function readerStyle() {
    var st = settings(), col = readerColors(), hl = {};
    Object.keys(HL_COLORS).forEach(function (k) { hl[k] = col.dark ? HL_DARK[k] : HL_COLORS[k][1]; });
    var ins = Kit.insets();
    return {
      dark: col.dark, mode: st.mode, font: st.font, size: st.size, line: st.line, margin: st.margin, justify: st.justify, hyphens: st.hyphens,
      top: Math.round(ins.top + 20), bottom: Math.round(ins.bottom + 40),
      colors: { ink: col.ink, muted: col.muted, link: col.link, pri: col.pri, hl: hl, sel: col.dark ? 'rgba(131,165,152,.45)' : 'rgba(58,106,138,.28)', tts: col.dark ? 'rgba(131,165,152,.38)' : 'rgba(58,106,138,.22)', find: col.dark ? 'rgba(254,128,25,.45)' : 'rgba(254,128,25,.35)' },
    };
  }

  function encodePath(p) { return p.split('/').map(encodeURIComponent).join('/'); }

  /* Builds the reader's view of a book: chapters, contents, language. Promise<{chapters, toc, lang, kind}>. */
  function bookModel(b) {
    if (b.format === 'epub') {
      var st; try { st = JSON.parse(nat('structure', b.id) || '{}'); } catch (e) { st = { error: 'This book can’t be read' }; }
      if (st.error) return Promise.reject(st.error);
      var spine = st.spine.filter(function (s) { return s.linear; });
      if (!spine.length) spine = st.spine;
      var chapters = spine.map(function (s) { return { path: s.path, src: '/book/' + b.id + '/' + encodePath(s.path), title: '' }; });
      var toc = [];
      st.toc.forEach(function (t) {
        var c = chapters.findIndex(function (ch) { return ch.path === t.path; });
        if (c < 0) return;
        toc.push({ label: t.label, c: c, frag: t.frag, depth: t.depth });
        if (!chapters[c].title) chapters[c].title = t.label;
      });
      for (var i = 0, last = ''; i < chapters.length; i++) { if (chapters[i].title) last = chapters[i].title; else chapters[i].title = last || st.title || b.title; }
      return Promise.resolve({ kind: 'flow', chapters: chapters, toc: toc, lang: (st.language || b.lang || '').split('-')[0], title: st.title || b.title, description: st.description || '' });
    }
    if (b.format === 'txt' || b.format === 'md') {
      return fetch('/raw/' + b.id).then(function (r) { if (!r.ok) throw new Error('This book can’t be opened'); return r.text(); }).then(function (text) {
        var lang = b.lang || '';
        var parts = b.format === 'md' ? L.markdownChapters(text) : L.textChapters(text).map(function (c) { return { title: c.title, html: L.textChapterHtml(c) }; });
        var chapters = parts.map(function (p) { return { title: p.title, html: L.chapterDoc(p.title, p.html, lang) }; });
        return { kind: 'flow', chapters: chapters, toc: chapters.map(function (c, i) { return { label: c.title, c: i, depth: 0 }; }), lang: lang, title: b.title };
      });
    }
    if (b.format === 'html') {
      return Promise.resolve({ kind: 'flow', chapters: [{ path: 'index.html', src: '/book/' + b.id + '/index.html', title: b.title }], toc: [{ label: b.title, c: 0, depth: 0 }], lang: b.lang, title: b.title });
    }
    if (b.format === 'pdf') {
      var info; try { info = JSON.parse(nat('pdfInfo', b.id) || '{}'); } catch (e) { info = { error: 'This PDF can’t be opened' }; }
      if (info.error) return Promise.reject(info.error);
      return Promise.resolve({ kind: 'pdf', pages: info.pages, sizes: info.sizes, text: !!info.text, title: b.title, toc: [] });
    }
    if (b.format === 'cbz') {
      var cs; try { cs = JSON.parse(nat('structure', b.id) || '{}'); } catch (e) { cs = { error: 'This comic can’t be opened' }; }
      if (cs.error) return Promise.reject(cs.error);
      return Promise.resolve({ kind: 'cbz', pages: cs.pages.length, list: cs.pages, title: b.title, toc: [] });
    }
    return Promise.reject('Margin can’t open this kind of file');
  }

  function openBook(id, target) {
    var b = S.byId[id];
    if (!b) return;
    flush();
    S.sheet = null;
    if (top().s === 'reader') { closeReader(); S.nav.pop(); }
    S.nav.push({ s: 'reader', id: id });
    lib().last = id; touch('library');
    var d = bookDoc(id);
    if (!d.started) d.started = Date.now();
    d.opened = Date.now();
    if (d.finished && d.frac >= 0.999) { d.pos = null; d.frac = 0; d.finished = 0; if (d.shelf === 'finished') d.shelf = ''; }
    touch('b-' + id);
    S.reader = new ReaderUI(b, target);
    render();
  }
  app.openBook = openBook;

  function closeReader() {
    if (!S.reader) return;
    S.reader.close();
    S.reader = null;
    nat('setReading', false, false);
    flush();
  }

  // ---------------------------------------------------------------- ReaderUI: chrome around the reading surface
  function ReaderUI(b, target) {
    this.b = b;
    this.d = bookDoc(b.id);
    this.chrome = false;
    this.mounted = false;
    this.target = target || null;
    this.info = { page: 0, pages: 1, chapterFraction: 0 };
    this.pos = this.d.pos || { c: 0, p: 0, o: 0 };
    this.jumpBack = null;
    app.hooks.forEach(function (h) { if (h.create) h.create(this); }, this);
  }
  app.hooks = []; // later features (pace, read-aloud, recap) plug in here
  var RU = ReaderUI.prototype;

  RU.mount = function () {
    var self = this, b = this.b;
    this.mounted = true;
    $('#app').innerHTML = '<div class="screen s-reader" data-screen="reader"><div class="rhost" id="rhost"></div><div class="loading" id="rload">Opening…</div><div id="rchrome"></div></div>';
    this.applyPaper();
    nat('setReading', true, settings().volumeKeys !== false);
    bookModel(b).then(function (m) {
      if (!self.mounted) return;
      self.model = m;
      $('#rload').remove();
      if (m.kind === 'flow') self.mountFlow(m);
      else if (m.kind === 'pdf') self.mountPdf(m);
      else self.mountCbz(m);
      self.renderChrome();
      app.hooks.forEach(function (h) { if (h.opened) h.opened(self); });
    }).catch(function (err) {
      if (!self.mounted) return;
      var el = $('#rload');
      if (el) el.innerHTML = '<div class="k-empty"><b>Can’t open this book</b>' + esc(String(err && err.message || err)) + '<div style="margin-top:12px"><button type="button" class="k-btn tonal" data-a="back">Back to library</button></div></div>';
    });
  };

  RU.applyPaper = function () {
    var col = readerColors(), st = document.documentElement.style;
    st.setProperty('--paper', col.bg);
    st.setProperty('--paper-ink', col.ink);
    st.setProperty('--paper-muted', col.muted);
    st.setProperty('--paper-deep', col.deep);
    st.setProperty('--rm', settings().margin + 'px');
    if (N && N.setChrome) { try { N.setChrome(col.bg, col.dark); } catch (e) {} }
  };

  RU.mountFlow = function (m) {
    var self = this, d = this.d;
    if (d.mode === 'reflow' && this.b.format !== 'pdf') d.mode = '';
    this.r = new window.Reader($('#rhost'), {
      onPosition: function (pos, info) { self.moved(pos, info); },
      onTap: function (zone) { self.tap(zone); },
      onSelect: function (a, rect) { if (a) showSel(self, a, rect); else if (S.sel && !S.sel.keep) clearSel(); },
      onHighlight: function (h, rect) { showSel(self, Object.assign({ hl: h }, h), rect, h); },
      onNote: function (text, rect) { S.pop = { kind: 'note', title: 'Note', text: text, rect: rect }; renderOverlay(); },
      onExternal: function (url) { S.pop = { kind: 'ext', url: url }; renderOverlay(); },
      onJump: function (pos) { self.jumpBack = pos; self.renderChrome(); },
      onLoad: function (c) { self.loaded(c); },
      onEnd: function () { self.finished(); },
    });
    var t = this.target || d.pos || { c: 0, p: 0, o: 0 };
    this.r.open({ id: this.b.id, lang: m.lang, chapters: m.chapters }, t, readerStyle());
    this.r.setHighlights(d.hl);
  };

  RU.loaded = function (c) {
    this.r.setHighlights(this.d.hl);
    app.hooks.forEach(function (h) { if (h.chapter) h.chapter(this, c); }, this);
    this.renderChrome();
  };

  RU.moved = function (pos, info) {
    this.pos = pos;
    this.info = info;
    var d = this.d;
    d.pos = pos;
    d.frac = this.fraction();
    d.opened = Date.now();
    if (d.frac > 0.995 && !d.finished && this.model && this.model.kind === 'flow' && pos.c === this.model.chapters.length - 1 && info.page >= info.pages - 1) this.finished();
    touch('b-' + this.b.id);
    app.hooks.forEach(function (h) { if (h.moved) h.moved(this, pos, info); }, this);
    this.renderFoot();
    if (this.chrome) this.renderChrome();
  };

  /* Fraction of the book read: exact once the book's paragraphs are counted, estimated before. */
  RU.fraction = function () {
    var m = this.model, d = this.d;
    if (!m) return d.frac || 0;
    if (m.kind !== 'flow') return m.pages > 1 ? this.pos.c / (m.pages - 1) : 1;
    if (d.lens && d.lens.length === m.chapters.length) return L.fractionAt(this.pos, d.lens) * 0.999 + (this.atEnd() ? 0.001 : 0);
    var cf = this.info ? this.info.chapterFraction : 0;
    return Math.min(1, (this.pos.c + cf) / m.chapters.length);
  };
  RU.atEnd = function () { return this.model && this.pos.c === this.model.chapters.length - 1 && this.info.page >= this.info.pages - 1; };

  RU.finished = function () {
    var d = this.d;
    if (d.finished) return;
    d.finished = Date.now();
    d.frac = 1;
    if (d.shelf === 'reading' || d.shelf === 'toread') d.shelf = '';
    touch('b-' + this.b.id);
    snack('Finished — moved to your Finished shelf');
    app.hooks.forEach(function (h) { if (h.finished) h.finished(this); }, this);
  };

  RU.tap = function (zone) {
    if (S.sel) { clearSel(); return; }
    if (S.pop) { S.pop = null; renderOverlay(); return; }
    if (this.chrome && zone !== 'menu') { this.chrome = false; this.renderChrome(); return; }
    if (zone === 'next') this.next();
    else if (zone === 'prev') this.prev();
    else { this.chrome = !this.chrome; this.renderChrome(); }
  };
  RU.next = function () { if (this.r) this.r.next(); else if (this.pager) this.pager.next(); };
  RU.prev = function () { if (this.r) this.r.prev(); else if (this.pager) this.pager.prev(); };

  RU.chapterTitle = function () {
    var m = this.model;
    if (!m) return '';
    if (m.kind !== 'flow') return 'Page ' + (this.pos.c + 1) + ' of ' + m.pages;
    var best = '', c = this.pos.c, p = this.pos.p || 0, r = this.r;
    (m.toc || []).forEach(function (t) {
      if (t.c < c) best = t.label;
      else if (t.c === c && (!t.frag || !r || r.c !== c || r.blockOfFrag(t.frag) <= p)) best = t.label;
    });
    return best || (m.chapters[c] && m.chapters[c].title) || '';
  };

  RU.footText = function () {
    var m = this.model;
    if (!m) return ['', ''];
    var right = '';
    if (m.kind === 'flow') {
      var pace = app.pace ? app.pace(this) : null;
      right = pace && pace.chapter != null ? L.minutes(pace.chapter) + ' left in chapter' : this.info.pages > 1 ? (this.info.page + 1) + ' / ' + this.info.pages : '';
      if (settings().footer === 'book') right = pace && pace.book != null ? L.minutes(pace.book) + ' left in book' : pct(this.fraction());
      if (settings().footer === 'percent') right = pct(this.fraction());
    } else right = (this.pos.c + 1) + ' / ' + m.pages;
    return [this.chapterTitle(), right];
  };

  RU.renderFoot = function () {
    var f = $('#rfoot');
    if (!f) return;
    var t = this.footText();
    f.innerHTML = '<span class="l">' + esc(t[0]) + '</span><span>' + esc(t[1]) + '</span>';
  };

  RU.isBookmarked = function () {
    var pos = this.pos, d = this.d, end = this.r ? this.r.endPosition() : pos;
    return d.bm.some(function (m) { return m.c === pos.c && L.comparePos(m, pos) >= 0 && L.comparePos(m, end) <= 0; });
  };

  RU.renderChrome = function () {
    var el = $('#rchrome');
    if (!el) return;
    var m = this.model, b = this.b, f = this.fraction(), t = this.footText();
    var h = '<div class="rfoot" id="rfoot"' + (this.chrome ? ' style="visibility:hidden"' : '') + '><span class="l">' + esc(t[0]) + '</span><span>' + esc(t[1]) + '</span></div>';
    if (this.isBookmarked()) h += '<div class="ribbon"></div>';
    if (this.jumpBack && !this.chrome) h += '<button type="button" class="back-pill" data-a="jumpBack">' + Kit.icon('back') + 'Back to where you were</button>';
    var extraTools = app.hooks.map(function (hk) { return hk.tools ? hk.tools(this) : ''; }, this).join('');
    h += '<div class="' + (this.chrome ? '' : 'chrome-off') + '">' +
      '<div class="rtop">' + icb('back', Kit.icon('back'), 'Back to library') + '<div class="tt"><b>' + esc(m && m.title || b.title) + '</b><small>' + esc(this.chapterTitle()) + '</small></div>' +
      (m && m.kind === 'flow' ? icb('findInBook', Kit.icon('search'), 'Search in book') : '') +
      (m && m.kind === 'flow' ? icb('bookmark', ic('bookmark'), this.isBookmarked() ? 'Remove bookmark' : 'Add bookmark', this.isBookmarked() ? ' style="color:var(--err)"' : '') : '') +
      icb('contents', ic('toc'), 'Contents and notes') + icb('aa', ic('aa'), 'Reading settings') + '</div>' +
      '<div class="rbot"><div class="lbl"><span>' + esc(t[0]) + '</span><span id="slv">' + (m && m.kind !== 'flow' ? (this.pos.c + 1) + ' / ' + m.pages : pct(f)) + '</span></div>' +
      '<div class="row"><input type="range" id="slider" min="0" max="1000" value="' + Math.round(f * 1000) + '" style="--v:' + (f * 100).toFixed(1) + '%" aria-label="Position in book"></div>' +
      '<div class="tools">' + extraTools + icb('notebook', ic('note'), 'Notebook', ' data-id="' + b.id + '"') + '</div></div></div>';
    el.innerHTML = h;
    var sl = $('#slider'), self = this;
    if (sl) {
      sl.addEventListener('input', function () {
        var v = sl.value / 1000;
        sl.style.setProperty('--v', (v * 100) + '%');
        $('#slv').textContent = self.model && self.model.kind !== 'flow' ? (Math.round(v * (self.model.pages - 1)) + 1) + ' / ' + self.model.pages : pct(v);
      });
      sl.addEventListener('change', function () { self.seek(sl.value / 1000); });
    }
  };

  RU.seek = function (f) {
    var m = this.model;
    if (!m) return;
    this.jumpBack = this.pos;
    if (m.kind !== 'flow') { this.pager.go(Math.round(f * (m.pages - 1))); return; }
    var d = this.d;
    if (d.lens && d.lens.length === m.chapters.length) {
      var p = L.positionAt(f, d.lens);
      this.r.show(p.c, p);
    } else {
      var x = f * m.chapters.length, c = Math.min(m.chapters.length - 1, Math.floor(x));
      this.r.show(c, { f: x - c });
    }
  };

  RU.goTo = function (pos) {
    if (!this.r) { if (this.pager) this.pager.go(pos.c); return; }
    this.jumpBack = this.pos;
    this.r.show(pos.c, pos.frag ? { frag: pos.frag } : pos);
  };

  RU.restyle = function () {
    this.applyPaper();
    if (this.r) this.r.configure(readerStyle());
    nat('setReading', true, settings().volumeKeys !== false);
    this.renderChrome();
  };

  RU.paused = function () { flush(); app.hooks.forEach(function (h) { if (h.paused) h.paused(this); }, this); };
  RU.resumed = function () { app.hooks.forEach(function (h) { if (h.resumed) h.resumed(this); }, this); };

  RU.close = function () {
    app.hooks.forEach(function (h) { if (h.closed) h.closed(this); }, this);
    this.mounted = false;
    if (this.r) this.r.close();
    if (this.pager) this.pager.close();
    S.sel = null; S.pop = null;
    Kit.apply(); // system bars back to the app theme
  };

  // ---------------------------------------------------------------- PDF and comic pages
  RU.mountPdf = function (m) {
    var self = this, d = this.d, host = $('#rhost');
    if (d.mode === 'reflow' && m.text) { this.mountReflow(m); return; }
    var W = host.clientWidth, zoom = 1;
    var h = '<div class="pdfv" id="pdfv"><div class="pages" id="pdfp">';
    for (var i = 0; i < m.pages; i++) {
      var sz = m.sizes[i] || [612, 792];
      h += '<div class="pg" data-i="' + i + '" style="width:' + (W - 8) + 'px;height:' + Math.round((W - 8) * sz[1] / sz[0]) + 'px"><span class="no">' + (i + 1) + '</span></div>';
    }
    host.innerHTML = h + '</div></div>';
    var view = $('#pdfv'), pagesEl = $('#pdfp'), dpr = Math.min(2.5, window.devicePixelRatio || 2);
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var pg = e.target;
        if (e.isIntersecting && !pg.firstElementChild.tagName.match(/IMG/)) {
          pg.innerHTML = '<img alt="Page ' + (+pg.dataset.i + 1) + '" src="/pdf/' + self.b.id + '/' + pg.dataset.i + '?w=' + Math.round((W - 8) * dpr * zoom) + '">';
        }
      });
    }, { root: view, rootMargin: '150% 0px' });
    Array.prototype.forEach.call(pagesEl.children, function (pg) { io.observe(pg); });
    function current() {
      var mid = view.scrollTop + view.clientHeight * 0.3, kids = pagesEl.children;
      for (var i = 0; i < kids.length; i++) if (kids[i].offsetTop * zoom + kids[i].offsetHeight * zoom > mid) return i;
      return kids.length - 1;
    }
    var scT = null;
    view.addEventListener('scroll', function () {
      clearTimeout(scT);
      scT = setTimeout(function () { var c = current(); self.moved({ c: c, p: 0, o: 0 }, { page: c, pages: m.pages, chapterFraction: 0 }); }, 120);
    }, { passive: true });
    var tapX = 0, tapY = 0, tapT = 0, lastTap = 0, tapTimer = null;
    view.addEventListener('touchstart', function (e) { if (e.touches.length === 1) { tapX = e.touches[0].clientX; tapY = e.touches[0].clientY; tapT = Date.now(); } }, { passive: true });
    view.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0];
      if (Math.abs(t.clientX - tapX) > 10 || Math.abs(t.clientY - tapY) > 10 || Date.now() - tapT > 400) return;
      var now = Date.now();
      if (now - lastTap < 300) {
        clearTimeout(tapTimer); lastTap = 0;
        // double-tap: zoom to 2x around the tap, or back to fit
        var keep = current();
        zoom = zoom > 1 ? 1 : 2;
        pagesEl.style.width = zoom > 1 ? (W * zoom) + 'px' : '';
        Array.prototype.forEach.call(pagesEl.children, function (pg) {
          var i = +pg.dataset.i, sz = m.sizes[i] || [612, 792];
          pg.style.width = ((W - 8) * zoom) + 'px'; pg.style.height = Math.round((W - 8) * zoom * sz[1] / sz[0]) + 'px';
          if (pg.firstElementChild && pg.firstElementChild.tagName === 'IMG') pg.firstElementChild.src = '/pdf/' + self.b.id + '/' + i + '?w=' + Math.round((W - 8) * dpr * zoom);
        });
        var kid = pagesEl.children[keep];
        view.scrollTop = kid.offsetTop;
        if (zoom > 1) view.scrollLeft = Math.max(0, t.clientX * zoom - W / 2);
        return;
      }
      lastTap = now;
      tapTimer = setTimeout(function () { self.tap('menu'); }, 300);
    }, { passive: true });
    view.addEventListener('click', function (e) { if (!('ontouchstart' in window)) self.tap(e.clientX < W * 0.28 ? 'prev' : e.clientX > W * 0.72 ? 'next' : 'menu'); });
    this.pager = {
      go: function (i) { var kid = pagesEl.children[Math.max(0, Math.min(m.pages - 1, i))]; if (kid) view.scrollTop = kid.offsetTop * zoom - 8; },
      next: function () { view.scrollBy({ top: view.clientHeight * 0.85, behavior: 'smooth' }); },
      prev: function () { view.scrollBy({ top: -view.clientHeight * 0.85, behavior: 'smooth' }); },
      close: function () { io.disconnect(); },
    };
    var start = (this.target && this.target.c) || (d.pos && d.pos.c) || 0;
    setTimeout(function () { self.pager.go(start); self.moved({ c: start, p: 0, o: 0 }, { page: start, pages: m.pages, chapterFraction: 0 }); }, 30);
  };

  /* PDF as flowing text (Android 15+): the text layer, joined into paragraphs, shown by the normal reader. */
  RU.mountReflow = function (m) {
    var self = this;
    $('#rhost').innerHTML = '<div class="loading">Reading the text of this PDF…</div>';
    call('pdfText', [this.b.id]).then(function (r) {
      if (!self.mounted) return;
      var t = r && r.text || {};
      if (t.error || !t.pages) { self.d.mode = ''; snack(t.error || 'This PDF has no text to reflow'); self.mountPdf(m); self.renderChrome(); return; }
      var paras = L.pdfParagraphs(t.pages), chapters = [];
      var total = paras.reduce(function (n, p) { return n + p.length; }, 0);
      if (!total) { self.d.mode = ''; snack('This PDF is made of page images; there is no text to reflow'); self.mountPdf(m); self.renderChrome(); return; }
      for (var i = 0; i < paras.length; i += 10) {
        var html = '', title = 'Pages ' + (i + 1) + '–' + Math.min(paras.length, i + 10);
        for (var k = i; k < Math.min(paras.length, i + 10); k++) html += '<h6 class="pgno">Page ' + (k + 1) + '</h6>' + paras[k].map(function (p) { return '<p>' + L.esc(p) + '</p>'; }).join('');
        chapters.push({ title: title, html: L.chapterDoc(title, html, '') });
      }
      self.model = { kind: 'flow', chapters: chapters, toc: chapters.map(function (c, i) { return { label: c.title, c: i, depth: 0 }; }), title: m.title, pdf: m, reflow: true };
      $('#rhost').innerHTML = '';
      self.mountFlow(self.model);
      self.renderChrome();
    });
  };

  RU.mountCbz = function (m) {
    var self = this, host = $('#rhost'), d = this.d, i = (this.target && this.target.c) || (d.pos && d.pos.c) || 0;
    host.innerHTML = '<div class="cbz" id="cbz"><img id="cbzimg" alt=""></div>';
    var img = $('#cbzimg'), view = $('#cbz');
    function show(n) {
      i = Math.max(0, Math.min(m.pages - 1, n));
      img.src = '/book/' + self.b.id + '/' + encodePath(m.list[i]);
      img.alt = 'Page ' + (i + 1);
      self.moved({ c: i, p: 0, o: 0 }, { page: i, pages: m.pages, chapterFraction: 0 });
    }
    var sx = 0, sy = 0, st = 0;
    view.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }, { passive: true });
    view.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, W = view.clientWidth;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { show(i + (dx < 0 ? 1 : -1)); return; }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - st < 400) self.tap(t.clientX < W * 0.28 ? 'prev' : t.clientX > W * 0.72 ? 'next' : 'menu');
    }, { passive: true });
    this.pager = { go: show, next: function () { show(i + 1); }, prev: function () { show(i - 1); }, close: function () {} };
    show(i);
  };

  // ---------------------------------------------------------------- selection toolbar, highlights and notes
  function showSel(ru, a, rect, existing) {
    S.sel = { ru: ru, a: a, rect: rect, hl: existing || null, keep: false };
    S.pop = null;
    renderOverlay();
  }
  function clearSel() {
    if (S.sel && S.sel.ru && S.sel.ru.r) S.sel.ru.r.clearSelection();
    S.sel = null;
    renderOverlay();
  }
  function selbarHtml() {
    var sl = S.sel, r = sl.rect || { top: 200, bottom: 220, left: 100, right: 200 }, hl = sl.hl;
    var vh = window.innerHeight, above = r.top > 120;
    var y = above ? Math.max(Kit.insets().top + 8, r.top - 60) : Math.min(vh - 64 - Kit.insets().bottom, r.bottom + 12);
    var h = '<div class="selbar" role="toolbar" aria-label="Selected text" style="top:' + Math.round(y) + 'px;left:8px">';
    Object.keys(HL_COLORS).forEach(function (k) {
      h += '<button type="button" class="sw' + (hl && hl.color === k ? ' on' : '') + '" style="background:' + HL_COLORS[k][0] + '" data-a="hl" data-v="' + k + '" aria-label="Highlight ' + k + '"></button>';
    });
    if (hl) h += '<button type="button" data-a="hlDelete" aria-label="Remove highlight">' + Kit.icon('trash') + '</button>';
    h += '<span class="sep"></span><button type="button" data-a="hlNote">' + ic('note') + (hl && hl.note ? 'Edit note' : 'Note') + '</button>';
    h += app.selTools.map(function (f) { return f(sl); }).join('');
    h += '<button type="button" data-a="selCopy" aria-label="Copy">' + ic('copy') + '</button>';
    return h + '</div>';
  }
  app.selTools = [];

  function hlId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function saveHighlight(color, note) {
    var sl = S.sel;
    if (!sl) return null;
    var ru = sl.ru, d = ru.d, h = sl.hl;
    if (!h) {
      h = { id: hlId(), c: sl.a.c, s: sl.a.s, e: sl.a.e, text: sl.a.text, context: sl.a.context, color: color || 'yellow', note: '', created: Date.now(), chapter: ru.chapterTitle() };
      if (ru.model && ru.model.reflow) h.reflow = 1;
      d.hl.push(h);
      d.hl.sort(function (x, y) { return L.comparePos({ c: x.c, p: x.s.p, o: x.s.o }, { c: y.c, p: y.s.p, o: y.s.o }); });
    } else if (color) h.color = color;
    if (note != null) h.note = note;
    h.updated = Date.now();
    touch('b-' + ru.b.id);
    ru.r.setHighlights(d.hl);
    return h;
  }

  // ---------------------------------------------------------------- overlays
  function renderOverlay() {
    var o = $('#overlay'), h = '';
    if (S.sel && top().s === 'reader') h += selbarHtml();
    if (S.pop) h += popHtml(S.pop);
    if (S.sheet) {
      var sh = S.sheet, body = sheets[sh.kind] ? sheets[sh.kind](sh) : '';
      h += '<button type="button" class="k-scrim" data-a="sheetClose" aria-label="Close"></button><div class="k-sheet' + (sh.tall ? ' tall' : '') + '" role="dialog" aria-label="' + esc(sh.label || '') + '"><div class="k-grab"></div>' + body + '</div>';
    }
    if (S.modal) {
      var m = S.modal;
      h += '<button type="button" class="k-scrim" data-a="modalNo" aria-label="Cancel"></button><div class="k-modal" role="alertdialog" aria-label="' + esc(m.title) + '"><h3>' + esc(m.title) + '</h3>' + (m.body ? '<p>' + esc(m.body) + '</p>' : '') +
        (m.input != null ? '<' + (m.multiline ? 'textarea rows="5" style="height:auto;padding:12px 14px;resize:none;margin-top:12px"' : 'input style="margin-top:12px"') + ' class="k-field" id="mfield" placeholder="' + esc(m.placeholder || '') + '" value="' + (m.multiline ? '' : esc(m.input)) + '">' + (m.multiline ? esc(m.input) + '</textarea>' : '') : '') +
        '<div class="k-acts">' + (m.extra ? '<button type="button" class="k-btn text-danger sm" data-a="modalExtra" style="margin-right:auto">' + esc(m.extra) + '</button>' : '') + '<button type="button" class="k-btn sm" data-a="modalNo">' + esc(m.noLabel || 'Cancel') + '</button><button type="button" class="k-btn ' + (m.danger ? 'danger' : 'filled') + ' sm" data-a="modalOk">' + esc(m.okLabel || 'OK') + '</button></div></div>';
    }
    if (S.snack) h += '<div class="k-snack" role="status"' + (top().s === 'reader' ? ' style="bottom:calc(56px + var(--kit-bottom))"' : '') + '><span>' + esc(S.snack.msg) + '</span>' + (S.snack.undo ? '<button type="button" data-a="undo">Undo</button>' : '') + '</div>';
    var had = document.activeElement && document.activeElement.id === 'mfield';
    o.innerHTML = h;
    var mf = $('#mfield');
    if (mf && !had) { setTimeout(function () { mf.focus(); var v = mf.value; mf.value = ''; mf.value = v; }, 40); }
    if (S.sheet && sheets[S.sheet.kind + 'After']) sheets[S.sheet.kind + 'After'](S.sheet);
    Kit.syncBack();
  }
  app.renderOverlay = renderOverlay;
  function popHtml(p) {
    var y = p.rect ? (p.rect.top > window.innerHeight / 2 ? 'bottom:' + Math.round(window.innerHeight - p.rect.top + 12) + 'px' : 'top:' + Math.round(p.rect.bottom + 12) + 'px') : 'bottom:calc(24px + var(--kit-bottom))';
    var body = p.kind === 'ext'
      ? '<div class="ph">' + ic('link') + '<span>Link to a website</span><span class="k-sp"></span>' + icb('popClose', Kit.icon('close'), 'Close') + '</div><div class="k-mono" style="font-size:13px;overflow-wrap:anywhere">' + esc(p.url) + '</div><p class="k-muted" style="font-size:13.5px;margin:8px 0 0">Margin has no internet access, so links in books never open. You can copy it.</p><div class="acts2"><button type="button" class="k-btn tonal sm" data-a="copyText" data-v="' + esc(p.url) + '">' + ic('copy') + 'Copy link</button></div>'
      : app.pops[p.kind] ? app.pops[p.kind](p) : '<div class="ph"><span>' + esc(p.title || '') + '</span><span class="k-sp"></span>' + icb('popClose', Kit.icon('close'), 'Close') + '</div><div>' + esc(p.text || '') + '</div>';
    return '<div class="pop" role="dialog" style="' + y + '">' + body + '</div>';
  }
  app.pops = {};

  function closeSheet() { S.sheet = null; renderOverlay(); }
  var sheets = { book: bookSheetHtml };
  app.sheets = sheets;

  // contents, bookmarks and highlights for the open book
  sheets.contents = function (sh) {
    var ru = S.reader, m = ru && ru.model;
    if (!m) return '';
    var tab = sh.tab || 'toc', d = ru.d;
    var h = '<div class="k-seg" role="tablist" style="margin:0 4px 8px">' + [['toc', 'Contents'], ['bm', 'Bookmarks ' + d.bm.length], ['hl', 'Highlights ' + d.hl.length]].map(function (t) {
      return '<button type="button" role="tab" aria-checked="' + (tab === t[0]) + '" data-a="ctab" data-v="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div><div class="sbody toc" id="sbody">';
    if (tab === 'toc') {
      if (m.kind !== 'flow') {
        h += '<div class="k-empty">' + (m.kind === 'pdf' && m.text ? 'This PDF has no table of contents. Turn on <b>Flowing text</b> in Aa to read it like a book.' : 'Use the slider to move through the pages.') + '</div>';
      } else {
        var cur = -1;
        m.toc.forEach(function (t, i) { if (t.c <= ru.pos.c) cur = i; });
        h += m.toc.map(function (t, i) {
          var pc = d.lens && d.lens.length === m.chapters.length ? pct(L.fractionAt({ c: t.c, p: 0, o: 0 }, d.lens)) : '';
          return '<button type="button" class="ti d' + Math.min(3, t.depth) + (i === cur ? ' cur' : '') + '" data-a="tocGo" data-i="' + i + '"' + (i === cur ? ' id="tcur"' : '') + '><span>' + esc(t.label) + '</span><small>' + pc + '</small></button>';
        }).join('');
      }
    } else if (tab === 'bm') {
      if (!d.bm.length) h += '<div class="k-empty"><b>No bookmarks</b>Tap the ribbon at the top while reading to keep a page.</div>';
      h += d.bm.map(function (bm) {
        return '<div style="display:flex;align-items:center"><button type="button" class="hl-card" data-a="bmGo" data-id="' + bm.id + '"><span class="bar2" style="background:var(--err)"></span><div><div class="q">' + esc(bm.text || 'Bookmark') + '</div><div class="w">' + esc(bm.chapter || '') + ' · ' + esc(ago(bm.created)) + '</div></div></button>' + icb('bmDel', Kit.icon('trash'), 'Delete bookmark', ' data-id="' + bm.id + '"') + '</div>';
      }).join('');
    } else {
      if (!d.hl.length) h += '<div class="k-empty"><b>No highlights</b>Select text while reading to highlight it or add a note.</div>';
      h += d.hl.map(hlCard).join('');
    }
    return h + '</div>';
  };
  sheets.contentsAfter = function () { var c = $('#tcur'); if (c) c.scrollIntoView({ block: 'center' }); };
  function hlCard(hl) {
    return '<button type="button" class="hl-card" data-a="hlGo" data-id="' + hl.id + '"><span class="bar2" style="background:' + (HL_COLORS[hl.color] || HL_COLORS.yellow)[0] + '"></span><div><div class="q">' + esc(hl.text) + '</div>' +
      (hl.note ? '<div class="n">' + esc(hl.note) + '</div>' : '') + '<div class="w">' + esc(hl.chapter || '') + ' · ' + esc(ago(hl.created)) + '</div></div></button>';
  }
  app.hlCard = hlCard;

  // Aa: reading settings
  sheets.aa = function () {
    var st = settings(), ru = S.reader, isPdf = ru && ru.b.format === 'pdf', reflow = ru && ru.model && ru.model.reflow;
    var h = '<h3>Reading</h3><div class="aa">';
    if (isPdf) {
      h += '<div class="k-group" style="margin:0 0 12px">' + row({ icon: ic('text'), t: 'Flowing text', sub: ru.model.text || reflow ? 'Text that fits the screen instead of page images' : 'Needs Android 15 or newer', btn: (ru.model.text || reflow) ? sw(reflow, 'reflow', 'Flowing text') : '' }) + '</div>';
      if (!reflow) return h + '</div>';
    }
    var fonts = [['literata', 'Aa', 'Literata', '"Literata",serif'], ['figtree', 'Aa', 'Figtree', 'Figtree,sans-serif'], ['serif', 'Aa', 'Georgia', 'Georgia,serif'], ['mono', 'Aa', 'Mono', '"JetBrains Mono",monospace'], ['book', 'Aa', 'Book’s own', 'inherit']];
    h += '<div class="fonts" role="radiogroup" aria-label="Font">' + fonts.map(function (f) {
      return '<button type="button" role="radio" aria-checked="' + (st.font === f[0]) + '" data-a="set" data-k="font" data-v="' + f[0] + '" style="font-family:' + f[3] + '">' + f[1] + '<small>' + f[2] + '</small></button>';
    }).join('') + '</div>';
    h += '<div class="k-group" style="margin:12px 0 0">';
    h += '<div class="k-row"><span class="k-rt"><span class="k-t">Text size</span></span><div class="stepper"><button type="button" data-a="size" data-v="-1" aria-label="Smaller">A−</button><span class="v">' + st.size + '</span><button type="button" data-a="size" data-v="1" aria-label="Larger">A+</button></div></div>';
    h += '<div class="k-row k-col"><div class="k-rt"><span class="k-t">Line spacing</span></div>' + seg('Line spacing', [[1.3, 'Tight'], [1.55, 'Normal'], [1.8, 'Loose'], [2.1, 'Airy']], st.line, 'set" data-k="line" data-num="1') + '</div>';
    h += '<div class="k-row k-col"><div class="k-rt"><span class="k-t">Margins</span></div>' + seg('Margins', [[12, 'Narrow'], [24, 'Normal'], [40, 'Wide']], st.margin, 'set" data-k="margin" data-num="1') + '</div>';
    h += '<div class="k-row k-col"><div class="k-rt"><span class="k-t">Layout</span></div>' + seg('Layout', [['paged', 'Pages'], ['scroll', 'Scrolling']], st.mode, 'set" data-k="mode') + '</div>';
    h += row({ t: 'Justify text', sub: 'Even right edge', btn: sw(st.justify, 'toggle', 'Justify text', ' data-k="justify"') });
    h += row({ t: 'Hyphenation', sub: 'Break long words at line ends', btn: sw(st.hyphens, 'toggle', 'Hyphenation', ' data-k="hyphens"') });
    h += '</div>';
    var cur = Kit.current();
    h += '<div class="k-cap pri" style="padding-left:4px">Page colour</div><div class="themes" role="radiogroup" aria-label="Page colour">' +
      [['app', cur.name, cur.c.bg, cur.c.ink], ['sepia', 'Sepia', SEPIA.bg, SEPIA.ink]].map(function (t) {
        return '<div><button type="button" role="radio" aria-checked="' + (st.paper === t[0]) + '" data-a="set" data-k="paper" data-v="' + t[0] + '" style="background:' + t[2] + ';color:' + t[3] + '">Aa</button><span class="lab">' + esc(t[1]) + '</span></div>';
      }).join('') + '<div><button type="button" data-a="go" data-to="settings" style="background:var(--cont);color:var(--ink)">' + Kit.icon('palette') + '</button><span class="lab">Themes</span></div></div>';
    h += '<div class="k-group" style="margin:12px 0 0">' + row({ t: 'Volume keys turn pages', btn: sw(st.volumeKeys !== false, 'toggle', 'Volume keys turn pages', ' data-k="volumeKeys"') }) +
      '<div class="k-row k-col"><div class="k-rt"><span class="k-t">Bottom line shows</span></div>' + seg('Bottom line', [['chapter', 'Chapter time'], ['book', 'Book time'], ['percent', 'Percent']], st.footer, 'set" data-k="footer') + '</div></div>';
    return h + '</div>';
  };

  // ================================================================ settings
  views.settings = {
    html: function () {
      refreshStatus();
      var st = S.status, se = settings();
      var o = '<div class="page">' + subHeader('Settings') + '<div class="pscroll" data-k="settings">';
      o += '<div id="kitapp">' + Kit.appearanceHtml() + '</div>';
      o += capRow('Books') + '<div class="k-group">';
      o += row({ icon: '<span class="dot" style="background:' + (st.allFiles ? 'var(--ok)' : 'var(--warn)') + '"></span>', t: st.allFiles ? 'Finding books in your folders' : 'Only books you add', sub: st.allFiles ? 'Margin reads the folders below (it never changes them)' : 'Allow access so Margin can find books in Books and Download', btn: st.allFiles ? '' : '<button type="button" class="k-btn tonal sm" data-a="allFiles">Allow</button>' });
      if (st.allFiles) {
        (st.folders || []).forEach(function (f) { o += row({ icon: Kit.icon('folder'), t: f.split('/').pop() || f, sub: f.replace(st.root || '', '') || '/', btn: icb('removeFolder', Kit.icon('close'), 'Stop looking in ' + f, ' data-v="' + esc(f) + '"') }); });
        o += row({ a: 'go', attrs: ' data-to="folders"', icon: ic('folderPlus'), t: 'Add a folder', chev: true });
      }
      o += row({ a: 'importBooks', icon: Kit.icon('plus'), t: 'Add books', sub: 'EPUB, PDF, text, Markdown, HTML and CBZ', chev: true });
      o += '</div>';
      o += app.settingsSections.map(function (f) { return f(); }).join('');
      o += capRow('Privacy') + '<div class="k-group">' +
        row({ icon: '<span class="dot" style="background:' + (st.noInternet !== false ? 'var(--ok)' : 'var(--err)') + '"></span>', t: st.noInternet !== false ? 'No internet permission' : 'Internet permission present', sub: 'Books, notes, the dictionary and recaps all stay on this phone' }) + '</div>';
      o += '<p class="k-about">Margin ' + esc(st.version || '') + '<br>Part of a suite of offline apps · themes from karui<br>Literata font © The Literata Project Authors (OFL)' + app.credits.join('') + '</p>';
      return o + '</div></div>';
    },
    after: function () { var ka = $('#kitapp'); if (ka) Kit.bindAppearance(ka, function () { render(); }); },
  };
  app.settingsSections = [];
  app.credits = [];

  views.folders = {
    html: function (t) {
      var r; try { r = JSON.parse(nat('listDirs', t.path || '') || '{}'); } catch (e) { r = {}; }
      t.path = r.path || '';
      var o = '<div class="page">' + subHeader('Choose a folder', '', '') + '<div class="folder-path">' + esc(r.path || '') + '</div><div class="pscroll"><div class="k-group">';
      if (r.parent) o += row({ a: 'dirUp', attrs: ' data-v="' + esc(r.parent) + '"', icon: Kit.icon('back'), t: 'Up one level' });
      (r.dirs || []).forEach(function (d) { o += row({ a: 'dirOpen', attrs: ' data-v="' + esc(r.path + '/' + d) + '"', icon: Kit.icon('folder'), t: d, chev: true }); });
      if (!(r.dirs || []).length) o += row({ t: 'No folders inside', sub: '' });
      return o + '</div><div style="padding:16px"><button type="button" class="k-btn filled wide" data-a="useFolder" data-v="' + esc(r.path || '') + '">' + Kit.icon('check') + 'Look for books here</button></div></div></div>';
    },
  };

  // ================================================================ actions
  var A = app.actions = {
    back: function () { back(); },
    go: function (d) { S.sheet = null; go(d.to); },
    filter: function (d) { S.filter = d.v; S.scrolls.library = 0; render(); },
    search: function () { S.searching = true; S.query = ''; render(); },
    open: function (d) { openBook(d.id); },
    importBooks: function () {
      call('importBooks').then(function (r) {
        if (r && r.errors && r.errors.length) snack(r.errors[0]);
        if (r && r.ok) loadLibrary().then(function () { snack(plural(r.ids.length, 'book') + ' added'); if (r.ids.length === 1) { var b = S.byId[r.ids[0]]; if (b) bookSheet(b.id); } });
      });
    },
    allFiles: function () { nat('requestAllFiles'); },
    sheetClose: closeSheet,
    modalNo: function () { var m = S.modal; S.modal = null; renderOverlay(); if (m && m.cancel) m.cancel(); },
    modalOk: function () { var m = S.modal, f = $('#mfield'); S.modal = null; renderOverlay(); if (m && m.ok) m.ok(f ? f.value : undefined); },
    modalExtra: function () { var m = S.modal; S.modal = null; renderOverlay(); if (m && m.extraFn) m.extraFn(); },
    undo: function () { var u = S.snack && S.snack.undo; S.snack = null; renderOverlay(); if (u) u(); },
    popClose: function () { S.pop = null; renderOverlay(); },
    copyText: function (d) { copy(d.v); snack('Copied'); },
    setShelf: function (d) { var bd = bookDoc(d.id); bd.shelf = d.v; if (d.v === 'finished' && !bd.finished) { bd.finished = Date.now(); bd.frac = 1; } if (d.v !== 'finished' && bd.finished) bd.finished = 0; touch('b-' + d.id); renderOverlay(); render(); },
    toggleCol: function (d) { var bd = bookDoc(d.id), i = bd.collections.indexOf(d.v); if (i >= 0) bd.collections.splice(i, 1); else bd.collections.push(d.v); touch('b-' + d.id); renderOverlay(); if (top().s === 'library') render(); },
    newCollection: function (d) {
      confirmBox({ title: 'New collection', input: '', placeholder: 'For example “Swedish” or “Book club”', okLabel: 'Create', ok: function (v) {
        v = String(v || '').trim().slice(0, 40);
        if (!v) return;
        var l = lib();
        if (l.collections.indexOf(v) < 0) l.collections.push(v);
        if (d.id) { var bd = bookDoc(d.id); if (bd.collections.indexOf(v) < 0) bd.collections.push(v); touch('b-' + d.id); }
        touch('library');
        if (d.id) bookSheet(d.id); else { S.filter = 'c:' + v; render(); }
      } });
    },
    hideBook: function (d) {
      var b = S.byId[d.id];
      if (!b) return;
      lib().hidden[d.id] = 1; touch('library');
      S.sheet = null;
      S.books = S.books.filter(function (x) { return x.id !== d.id; });
      render();
      snack('Removed “' + b.title + '”', function () { delete lib().hidden[d.id]; touch('library'); loadLibrary(); });
    },
    // reader
    contents: function () { S.sheet = { kind: 'contents', tall: true, label: 'Contents', tab: 'toc' }; renderOverlay(); },
    ctab: function (d) { S.sheet.tab = d.v; renderOverlay(); },
    tocGo: function (d) { var t = S.reader.model.toc[+d.i]; closeSheet(); S.reader.chrome = false; S.reader.goTo({ c: t.c, frag: t.frag }); },
    hlGo: function (d) {
      var ru = S.reader, h = ru && ru.d.hl.find(function (x) { return x.id === d.id; });
      if (!h) return;
      closeSheet(); ru.chrome = false; ru.goTo({ c: h.c, p: h.s.p, o: h.s.o });
    },
    bmGo: function (d) { var ru = S.reader, m = ru.d.bm.find(function (x) { return x.id === d.id; }); if (!m) return; closeSheet(); ru.chrome = false; ru.goTo(m); },
    bmDel: function (d) { var ru = S.reader; ru.d.bm = ru.d.bm.filter(function (x) { return x.id !== d.id; }); touch('b-' + ru.b.id); renderOverlay(); ru.renderChrome(); },
    bookmark: function () {
      var ru = S.reader, d = ru.d;
      if (ru.isBookmarked()) {
        var end = ru.r.endPosition();
        d.bm = d.bm.filter(function (m) { return !(m.c === ru.pos.c && L.comparePos(m, ru.pos) >= 0 && L.comparePos(m, end) <= 0); });
      } else {
        var texts = ru.r.blockTexts(), t = (texts[ru.pos.p] || '').slice(ru.pos.o, ru.pos.o + 160);
        d.bm.push({ id: hlId(), c: ru.pos.c, p: ru.pos.p, o: ru.pos.o, text: L.clean(t), chapter: ru.chapterTitle(), created: Date.now() });
        d.bm.sort(L.comparePos);
        haptic('confirm');
      }
      touch('b-' + ru.b.id);
      ru.renderChrome();
    },
    jumpBack: function () { var ru = S.reader, p = ru.jumpBack; ru.jumpBack = null; if (p) ru.r ? ru.r.show(p.c, p) : ru.pager.go(p.c); ru.renderChrome(); },
    aa: function () { S.sheet = { kind: 'aa', label: 'Reading settings' }; S.reader.chrome = false; S.reader.renderChrome(); renderOverlay(); },
    set: function (d, el) {
      var st = settings(), v = el.getAttribute('data-num') ? +d.v : d.v;
      st[d.k] = v; touch('settings');
      if (S.reader) S.reader.restyle();
      renderOverlay();
    },
    size: function (d) { var st = settings(); st.size = Math.max(12, Math.min(34, st.size + (+d.v))); touch('settings'); if (S.reader) S.reader.restyle(); renderOverlay(); },
    toggle: function (d) { var st = settings(); st[d.k] = !(st[d.k] !== false && st[d.k]); touch('settings'); if (S.reader) S.reader.restyle(); if (S.sheet) renderOverlay(); else render(); },
    reflow: function () {
      var ru = S.reader, d = ru.d;
      d.mode = d.mode === 'reflow' ? '' : 'reflow';
      d.pos = null;
      touch('b-' + ru.b.id);
      closeSheet();
      var id = ru.b.id;
      closeReader(); S.nav.pop();
      openBook(id);
    },
    // selection
    hl: function (d) { saveHighlight(d.v); haptic('tick'); clearSel(); },
    hlDelete: function () {
      var sl = S.sel, ru = sl.ru, h = sl.hl;
      ru.d.hl = ru.d.hl.filter(function (x) { return x.id !== h.id; });
      touch('b-' + ru.b.id); ru.r.setHighlights(ru.d.hl); clearSel();
      snack('Highlight removed', function () { ru.d.hl.push(h); touch('b-' + ru.b.id); ru.r.setHighlights(ru.d.hl); });
    },
    hlNote: function () {
      var sl = S.sel;
      if (!sl) return;
      sl.keep = true;
      var cur = sl.hl && sl.hl.note || '';
      confirmBox({ title: cur ? 'Edit note' : 'Note', body: '“' + sl.a.text.slice(0, 140) + (sl.a.text.length > 140 ? '…' : '') + '”', input: cur, multiline: true, placeholder: 'Your thoughts', okLabel: 'Save',
        ok: function (v) { S.sel = sl; saveHighlight(null, String(v || '').trim()); clearSel(); },
        cancel: function () { S.sel = sl; clearSel(); } });
    },
    selCopy: function () { var t = S.sel && S.sel.a.text; if (t) { copy(t); snack('Copied'); } clearSel(); },
    // settings
    removeFolder: function (d) { var f = (S.status.folders || []).filter(function (x) { return x !== d.v; }); nat('setFolders', JSON.stringify(f)); render(); loadLibrary(); },
    dirOpen: function (d) { top().path = d.v; render(); },
    dirUp: function (d) { top().path = d.v; render(); },
    useFolder: function (d) {
      var f = (S.status.folders || []).slice();
      if (f.indexOf(d.v) < 0) f.push(d.v);
      nat('setFolders', JSON.stringify(f));
      S.nav.pop(); render(); loadLibrary(); snack('Looking for books in ' + d.v.split('/').pop());
    },
  };

  // Covers fade in once loaded; a missing cover leaves the generated one showing.
  document.addEventListener('load', function (e) { if (e.target.tagName === 'IMG') e.target.classList.add('ok'); }, true);
  document.addEventListener('error', function (e) { if (e.target.tagName === 'IMG' && e.target.parentNode && e.target.parentNode.classList.contains('cv')) e.target.remove(); }, true);

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]');
    if (!el) return;
    var a = el.getAttribute('data-a');
    if (A[a]) { e.preventDefault(); A[a](el.dataset, el); }
  });

  // ---------------------------------------------------------------- time left (plugged in by the pace feature)
  function timeLeftBook(b) { return app.timeLeft ? app.timeLeft(b) : ''; }

  // ---------------------------------------------------------------- start
  Kit.onTheme(function () { if (S.reader && S.reader.mounted) S.reader.restyle(); });
  Kit.onInsets(function () { if (S.reader && S.reader.mounted && S.reader.r) S.reader.r.configure(readerStyle()); });

  window.addEventListener('DOMContentLoaded', function () {});
  Kit.apply();
  refreshStatus();
  app.ready = true;
  if (app.onReady) app.onReady.forEach(function (f) { f(); });
  render();
  loadLibrary().then(handleLaunch);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });

  // exposed for features in other files and for tests
  app.S = S; app.doc = doc; app.touch = touch; app.flush = flush; app.settings = settings; app.lib = lib; app.bookDoc = bookDoc;
  app.call = call; app.nat = nat; app.snack = snack; app.confirmBox = confirmBox; app.go = go; app.top = top; app.row = row; app.capRow = capRow;
  app.sw = sw; app.seg = seg; app.icb = icb; app.ic = ic; app.subHeader = subHeader; app.header = header; app.views = views; app.clearSel = clearSel;
  app.saveHighlight = saveHighlight; app.bookModel = bookModel; app.coverHtml = coverHtml; app.ago = ago; app.pct = pct; app.HL_COLORS = HL_COLORS;
  app.loadLibrary = loadLibrary; app.closeSheet = closeSheet; app.readerStyle = readerStyle; app.encodePath = encodePath; app.P = P; app.BOOK_ICON = BOOK_ICON;
})();
