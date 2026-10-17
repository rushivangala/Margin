/* Margin — the book's text index and search inside a book.

   Once a book is open its chapters are read in the background (the same way the reader lays them
   out, so paragraph numbers match) and kept as t-ID.json: the cleaned text of every block. That
   gives exact progress ("37%"), the position slider, search, recaps, names and reading pace.
   Search is word and phrase matching today; the index keeps whole paragraphs so a small
   sentence-embedding model can be added later without reading the books again. */
(function () {
  'use strict';
  var app = window.app, L = window.Logic, esc = Kit.esc;

  var building = {};

  /* Promise<texts[c][p]> for the open book (flowing text only). Cached per book and mode. */
  function textIndex(ru) {
    var m = ru.model;
    if (!m || m.kind !== 'flow') return Promise.resolve(null);
    var key = 't-' + ru.b.id + (m.reflow ? '-r' : '');
    if (ru.texts) return Promise.resolve(ru.texts);
    var have = app.doc(key, { v: 0 });
    if (have.v === 2 && have.n === m.chapters.length && have.texts) { ru.texts = have.texts; return Promise.resolve(have.texts); }
    if (building[key]) return building[key];
    var texts = [];
    var p = m.chapters.reduce(function (prev, ch, c) {
      return prev.then(function () {
        return chapterTexts(ch).then(function (t) { texts[c] = t; return new Promise(function (r) { setTimeout(r, 0); }); });
      });
    }, Promise.resolve()).then(function () {
      var d = app.doc(key, {});
      d.v = 2; d.n = m.chapters.length; d.texts = texts;
      app.touch(key);
      ru.texts = texts;
      var bd = ru.d;
      if (!m.reflow) {
        bd.lens = texts.map(L.lensOf);
        bd.words = L.wordCount(texts);
        bd.chapters = m.chapters.length;
        app.touch('b-' + ru.b.id);
      } else ru.reflowLens = texts.map(L.lensOf);
      delete building[key];
      if (ru.mounted) ru.renderChrome();
      return texts;
    }).catch(function (e) { delete building[key]; throw e; });
    building[key] = p;
    return p;
  }
  app.textIndex = textIndex;

  /* Cleaned block texts of one chapter, parsed the way the reader's frame parses it. */
  function chapterTexts(ch) {
    if (ch.html != null) return Promise.resolve(blocksOf(new DOMParser().parseFromString(ch.html, 'text/html')));
    return fetch(ch.src).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var d = new DOMParser().parseFromString(t, 'application/xhtml+xml');
      if (d.getElementsByTagName('parsererror').length || !d.body) d = new DOMParser().parseFromString(t, 'text/html');
      return blocksOf(d);
    }).catch(function () { return []; });
  }
  function blocksOf(d) { return L.blocks(d).text.map(L.clean); }
  app.chapterTexts = chapterTexts;

  // Index every flowing book once it opens; the exact percentages appear when it is done.
  app.hooks.push({
    opened: function (ru) {
      if (ru.model && ru.model.kind === 'flow') setTimeout(function () { if (ru.mounted) textIndex(ru).catch(function () {}); }, 400);
    },
  });

  // ---------------------------------------------------------------- search inside the open book
  app.actions.findInBook = function () {
    var ru = app.S.reader;
    if (!ru) return;
    ru.chrome = false; ru.renderChrome();
    app.S.sheet = { kind: 'find', tall: true, label: 'Search in book', q: app.S.lastFind || '', results: null };
    app.renderOverlay();
    var sh = app.S.sheet;
    textIndex(ru).then(function (t) { if (app.S.sheet === sh) { sh.ready = true; if (sh.q) run(sh); fill(sh); } });
  };
  function run(sh) {
    var ru = app.S.reader;
    sh.results = ru && ru.texts ? L.searchBook(ru.texts, sh.q, 300) : null;
  }
  app.sheets.find = function (sh) {
    return '<div style="display:flex;gap:8px;align-items:center;margin:0 0 8px"><input id="findq" class="k-field" type="search" placeholder="Words or a phrase" value="' + esc(sh.q) + '" autocomplete="off" enterkeyhint="search"></div>' +
      '<div class="sbody" id="findres">' + results(sh) + '</div>';
  };
  function results(sh) {
    var ru = app.S.reader, m = ru && ru.model;
    if (!sh.ready) return '<div class="k-empty">Reading the book…</div>';
    if (!sh.q.trim()) return '<div class="k-empty"><b>Search this book</b>Find a name, a word or a phrase. Results show in reading order.</div>';
    if (!sh.results || !sh.results.length) return '<div class="k-empty"><b>No matches</b>Check the spelling, or try fewer words.</div>';
    var exact = sh.results.filter(function (r) { return r.exact; }).length;
    var h = '<div class="k-cap"><span>' + (exact ? L.plural(exact, 'match', 'matches') : 'Paragraphs with all the words') + '</span><span class="k-sp"></span></div>';
    var lastC = -1;
    sh.results.forEach(function (r, i) {
      if (exact && !r.exact && sh.results[i - 1] && sh.results[i - 1].exact) h += '<div class="k-cap"><span>Paragraphs with all the words</span></div>';
      var label = chapterLabel(m, r.c);
      h += '<button type="button" class="res" data-a="findGo" data-i="' + i + '">' + (r.c !== lastC ? '<small>' + esc(label) + '</small>' : '') +
        '<span>' + esc(r.snippet.pre) + '<mark class="find">' + esc(r.snippet.hit) + '</mark>' + esc(r.snippet.post) + '</span></button>';
      lastC = r.c;
    });
    return h;
  }
  function chapterLabel(m, c) {
    var best = '';
    (m.toc || []).forEach(function (t) { if (t.c <= c) best = t.label; });
    return best || (m.chapters[c] && m.chapters[c].title) || 'Part ' + (c + 1);
  }
  function fill(sh) { var el = document.getElementById('findres'); if (el) el.innerHTML = results(sh); }
  var findT = null;
  app.sheets.findAfter = function (sh) {
    var q = document.getElementById('findq');
    if (!q || q.__bound) return;
    q.__bound = true;
    q.addEventListener('input', function () {
      clearTimeout(findT);
      findT = setTimeout(function () { sh.q = q.value; app.S.lastFind = sh.q; run(sh); fill(sh); }, 160);
    });
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') q.blur(); });
    if (!sh.q) setTimeout(function () { q.focus(); }, 60);
  };
  app.actions.findGo = function (d) {
    var sh = app.S.sheet, ru = app.S.reader, r = sh && sh.results && sh.results[+d.i];
    if (!r || !ru) return;
    app.closeSheet();
    ru.jumpBack = ru.pos;
    ru.findHit = r;
    ru.r.show(r.c, { p: r.p, o: rawAt(ru, r) }).then(function () { markHit(ru); });
    if (ru.r.c === r.c) markHit(ru);
  };
  function rawAt(ru, r) {
    // Before the chapter is shown its raw text is unknown; the clean offset is close enough to find the page.
    if (ru.r.c === r.c && ru.r.bl && ru.r.bl.text[r.p] != null) return L.rawOffset(ru.r.bl.text[r.p], r.o);
    return r.o;
  }
  function markHit(ru) {
    var r = ru.findHit;
    if (!r || ru.r.c !== r.c) return;
    var raw = ru.r.bl.text[r.p] || '', s = L.rawOffset(raw, r.o), e = L.rawOffset(raw, r.o + r.len - 1) + 1;
    ru.r.mark('find', [{ c: r.c, s: { p: r.p, o: s }, e: { p: r.p, o: e } }]);
    ru.r.go({ p: r.p, o: s });
    clearTimeout(ru.findT);
    ru.findT = setTimeout(function () { if (ru.r) ru.r.mark('find', []); }, 6000);
  }
})();
