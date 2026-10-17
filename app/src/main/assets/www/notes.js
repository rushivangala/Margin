/* Margin — the notebook: highlights, notes and bookmarks per book and across all books;
   export to Markdown, send to Daybook. */
(function () {
  'use strict';
  var app = window.app, L = window.Logic, esc = Kit.esc, S = app.S;

  function bookInfo(id) {
    var b = S.byId[id];
    return b ? { id: id, title: b.title, author: b.author } : { id: id, title: 'Removed book', author: '' };
  }

  /* Every book with notes: [{book, hl, bm, last}], most recently changed first. */
  function allNotes() {
    var keys = [];
    try { keys = JSON.parse(app.nat('keys', 'b-') || '[]'); } catch (e) { keys = []; }
    var list = [];
    keys.forEach(function (k) {
      var id = k.slice(2), d = app.bookDoc(id);
      if (!d.hl.length && !d.bm.length) return;
      var last = 0;
      d.hl.forEach(function (h) { last = Math.max(last, h.updated || h.created || 0); });
      d.bm.forEach(function (m) { last = Math.max(last, m.created || 0); });
      list.push({ book: bookInfo(id), hl: d.hl, bm: d.bm, last: last });
    });
    return list.sort(function (a, b) { return b.last - a.last; });
  }
  app.allNotes = allNotes;

  // ---------------------------------------------------------------- views
  app.views.notebook = {
    html: function (t) {
      var one = !!t.id, list = one ? [{ book: bookInfo(t.id), hl: app.bookDoc(t.id).hl, bm: app.bookDoc(t.id).bm }] : allNotes();
      var f = t.f || 'all', q = (t.q || '').trim().toLowerCase();
      var nHl = 0, nNote = 0;
      list.forEach(function (x) { nHl += x.hl.length; nNote += x.hl.filter(function (h) { return h.note; }).length; });
      var sub = one ? (list[0].book.title) : L.plural(list.length, 'book');
      var h = app.subHeader(one ? 'Notebook' : 'All notes', sub, app.icb('exportNotes', app.ic('export'), 'Export as Markdown') + (app.nat('hasDaybook') ? app.icb('notesToDaybook', app.ic('daybook'), 'Send to Daybook') : ''));
      h += '<div class="scroll" data-k="notebook:' + (t.id || '') + '">';
      if (!nHl && !list.some(function (x) { return x.bm.length; })) {
        return h + '<div class="k-empty" style="margin-top:32px"><div class="empty-art">' + app.ic('highlight') + '</div><b>No highlights yet</b>While reading, select some text to highlight it in one of four colours or to add a note. They all show up here.</div></div>';
      }
      h += '<div style="padding:4px 16px 0"><input id="nq" class="k-field" type="search" placeholder="Search your notes" value="' + esc(t.q || '') + '" autocomplete="off"></div>';
      h += '<div class="k-chips">' + [['all', 'All ' + nHl], ['notes', 'With notes ' + nNote]].concat(Object.keys(app.HL_COLORS).map(function (c) { return [c, '']; })).concat([['bm', 'Bookmarks']]).map(function (c) {
        var on = f === c[0];
        var dot = app.HL_COLORS[c[0]] ? '<span style="width:14px;height:14px;border-radius:7px;background:' + app.HL_COLORS[c[0]][0] + '"></span>' : '';
        return '<button type="button" class="k-chip" aria-pressed="' + on + '" data-a="nbFilter" data-v="' + c[0] + '"' + (dot ? ' aria-label="' + c[0] + ' highlights"' : '') + '>' + (on && !dot ? Kit.icon('check') : '') + dot + esc(c[1]) + '</button>';
      }).join('') + '</div><div id="nbres">' + results(list, f, q, one) + '</div><div class="pad-b"></div></div>';
      return h;
    },
    after: function (t) {
      var q = document.getElementById('nq');
      if (q) q.addEventListener('input', function () {
        t.q = q.value;
        var list = t.id ? [{ book: bookInfo(t.id), hl: app.bookDoc(t.id).hl, bm: app.bookDoc(t.id).bm }] : allNotes();
        document.getElementById('nbres').innerHTML = results(list, t.f || 'all', t.q.trim().toLowerCase(), !!t.id);
      });
    },
  };

  function results(list, f, q, one) {
    var h = '', any = false;
    list.forEach(function (x) {
      var items;
      if (f === 'bm') items = x.bm.map(function (m) { return { bm: m }; });
      else items = x.hl.filter(function (hl) { return f === 'all' || (f === 'notes' ? !!hl.note : hl.color === f); }).map(function (hl) { return { hl: hl }; });
      if (q) items = items.filter(function (it) { var o = it.hl || it.bm; return ((o.text || '') + ' ' + (o.note || '') + ' ' + (o.chapter || '') + ' ' + x.book.title).toLowerCase().indexOf(q) >= 0; });
      if (!items.length) return;
      any = true;
      if (!one) h += '<div class="k-cap pri"><span>' + esc(x.book.title) + '</span><span class="k-sp"></span><span class="k-n">' + items.length + '</span></div>';
      var last = null;
      items.forEach(function (it) {
        var o = it.hl || it.bm;
        if (one && o.chapter !== last) { h += '<div class="k-cap"><span>' + esc(o.chapter || '') + '</span></div>'; last = o.chapter; }
        if (it.hl) h += '<button type="button" class="hl-card" data-a="nbItem" data-book="' + x.book.id + '" data-id="' + o.id + '"><span class="bar2" style="background:' + (app.HL_COLORS[o.color] || app.HL_COLORS.yellow)[0] + '"></span><div><div class="q">' + esc(o.text) + '</div>' +
          (o.note ? '<div class="n">' + esc(o.note) + '</div>' : '') + '<div class="w">' + esc(one ? app.ago(o.created) : (o.chapter || '') + ' · ' + app.ago(o.created)) + '</div></div></button>';
        else h += '<button type="button" class="hl-card" data-a="nbBm" data-book="' + x.book.id + '" data-id="' + o.id + '"><span class="bar2" style="background:var(--err)"></span><div><div class="q">' + esc(o.text || 'Bookmark') + '</div><div class="w">' + esc((o.chapter || '') + ' · ' + app.ago(o.created)) + '</div></div></button>';
      });
    });
    return any ? h : '<div class="k-empty"><b>Nothing matches</b>Try another word or filter.</div>';
  }

  // ---------------------------------------------------------------- one highlight's sheet
  app.sheets.hl = function (sh) {
    var d = app.bookDoc(sh.book), h = d.hl.find(function (x) { return x.id === sh.id; }), b = bookInfo(sh.book);
    if (!h) return '';
    return '<div style="margin:0 4px 12px"><div class="k-muted" style="font-size:13px;margin-bottom:6px">' + esc(b.title + (h.chapter ? ' · ' + h.chapter : '')) + '</div>' +
      '<div style="font:16px/1.5 Literata,Georgia,serif;border-left:4px solid ' + (app.HL_COLORS[h.color] || app.HL_COLORS.yellow)[0] + ';padding-left:12px">' + esc(h.text) + '</div>' +
      (h.note ? '<div class="hl-card" style="padding:12px 0 0"><div><div class="n">' + esc(h.note) + '</div></div></div>' : '') + '</div>' +
      '<div class="k-group">' +
      (S.byId[sh.book] ? app.row({ a: 'hlOpen', icon: app.ic('book'), t: 'Go to the page' }) : '') +
      app.row({ a: 'hlEditNote', icon: app.ic('note'), t: h.note ? 'Edit note' : 'Add a note' }) +
      '<div class="k-row"><span class="k-rt"><span class="k-t">Colour</span></span><span style="display:flex;gap:10px">' + Object.keys(app.HL_COLORS).map(function (c) {
        return '<button type="button" data-a="hlColor" data-v="' + c + '" aria-label="' + c + '" style="width:28px;height:28px;border-radius:14px;background:' + app.HL_COLORS[c][0] + (h.color === c ? ';box-shadow:0 0 0 2px var(--low),0 0 0 4px var(--ink)' : '') + '"></button>';
      }).join('') + '</span></div>' +
      app.row({ a: 'hlDaybook', icon: app.ic('daybook'), t: 'Send to Daybook', sub: 'As a note tagged #reading' }) +
      app.row({ a: 'hlShare', icon: Kit.icon('share'), t: 'Share' }) +
      app.row({ a: 'hlCopy', icon: app.ic('copy'), t: 'Copy' }) +
      app.row({ a: 'hlRemove', icon: Kit.icon('trash'), t: 'Delete highlight' }) + '</div>';
  };
  function current() {
    var sh = S.sheet;
    if (!sh || sh.kind !== 'hl') return null;
    var d = app.bookDoc(sh.book), h = d.hl.find(function (x) { return x.id === sh.id; });
    return h ? { sh: sh, d: d, h: h, b: bookInfo(sh.book) } : null;
  }
  function changed(bookId) {
    app.touch('b-' + bookId);
    if (S.reader && S.reader.b.id === bookId && S.reader.r) S.reader.r.setHighlights(S.reader.d.hl);
  }

  var A = app.actions;
  A.notebook = function (d) {
    var id = d.id || (S.reader && S.reader.b.id);
    app.closeSheet();
    app.go('notebook', id ? { id: id } : {});
  };
  A.allNotes = function () { app.go('notebook', {}); };
  A.nbFilter = function (d) { var t = app.top(); t.f = t.f === d.v ? 'all' : d.v; app.render(); };
  A.nbItem = function (d) { S.sheet = { kind: 'hl', book: d.book, id: d.id, label: 'Highlight' }; app.renderOverlay(); };
  A.nbBm = function (d) {
    var m = app.bookDoc(d.book).bm.find(function (x) { return x.id === d.id; });
    if (m && S.byId[d.book]) app.openBook(d.book, { c: m.c, p: m.p, o: m.o });
  };
  A.hlOpen = function () { var c = current(); if (!c) return; app.closeSheet(); app.openBook(c.sh.book, { c: c.h.c, p: c.h.s.p, o: c.h.s.o }); };
  A.hlColor = function (d) { var c = current(); if (!c) return; c.h.color = d.v; c.h.updated = Date.now(); changed(c.sh.book); app.renderOverlay(); rerender(); };
  A.hlEditNote = function () {
    var c = current();
    if (!c) return;
    var sh = c.sh;
    S.sheet = null; // the note dialog replaces the sheet, and the sheet comes back after
    app.confirmBox({ title: c.h.note ? 'Edit note' : 'Note', input: c.h.note || '', multiline: true, placeholder: 'Your thoughts', okLabel: 'Save',
      ok: function (v) { c.h.note = String(v || '').trim(); c.h.updated = Date.now(); changed(sh.book); S.sheet = sh; app.renderOverlay(); rerender(); },
      cancel: function () { S.sheet = sh; app.renderOverlay(); } });
  };
  A.hlRemove = function () {
    var c = current();
    if (!c) return;
    c.d.hl = c.d.hl.filter(function (x) { return x !== c.h; });
    changed(c.sh.book);
    app.closeSheet(); rerender();
    app.snack('Highlight deleted', function () { c.d.hl.push(c.h); c.d.hl.sort(function (x, y) { return L.comparePos({ c: x.c, p: x.s.p, o: x.s.o }, { c: y.c, p: y.s.p, o: y.s.o }); }); changed(c.sh.book); rerender(); });
  };
  A.hlCopy = function () { var c = current(); if (!c) return; copy(L.highlightText(c.h, c.b)); app.closeSheet(); app.snack('Copied'); };
  A.hlShare = function () { var c = current(); if (!c) return; app.nat('shareText', c.b.title, L.highlightText(c.h, c.b)); };
  A.hlDaybook = function () { var c = current(); if (!c) return; app.closeSheet(); sendHighlight(c.h, c.b); };
  function rerender() { if (app.top().s === 'notebook') app.render(); }
  function copy(t) { try { if (window.KitNative) window.KitNative.copy(t); else if (navigator.clipboard) navigator.clipboard.writeText(t); } catch (e) {} }

  // ---------------------------------------------------------------- Daybook
  function toDaybook(title, text, key) {
    return app.call('toDaybook', [title, text, key || '']).then(function (r) {
      if (r && r.ok) return true;
      app.nat('shareText', title, text); // Daybook missing or too old: offer the share sheet instead
      return false;
    });
  }
  app.toDaybook = toDaybook;
  function sendHighlight(h, b) {
    return toDaybook(b.title, L.highlightText(h, b)).then(function (ok) {
      if (ok) { h.daybook = Date.now(); app.touch('b-' + b.id); app.snack('Sent to Daybook'); }
    });
  }
  A.notesToDaybook = function () {
    var t = app.top(), list = t.id ? [{ book: bookInfo(t.id), hl: app.bookDoc(t.id).hl, bm: app.bookDoc(t.id).bm }] : allNotes();
    var n = list.reduce(function (s, x) { return s + x.hl.length; }, 0);
    if (!n) { app.snack('No highlights to send'); return; }
    app.confirmBox({ title: 'Send to Daybook?', body: (t.id ? 'This book’s ' : 'All ') + L.plural(n, 'highlight') + ' become ' + (list.length === 1 ? 'one note' : L.plural(list.length, 'note')) + ' in Daybook, one per book. Sending again updates the same note.', okLabel: 'Send',
      ok: function () {
        var p = Promise.resolve(true);
        list.forEach(function (x) {
          if (!x.hl.length) return;
          p = p.then(function (ok) { return ok && toDaybook(x.book.title + ' — notes', L.notebookMarkdown(x.book, x.hl, x.bm).replace(/^# .*\n\n/, '') + '\n#reading', 'margin-notes-' + x.book.id); });
        });
        p.then(function (ok) { if (ok) app.snack('Sent to Daybook'); });
      } });
  };

  // selection toolbar: highlight and send in one tap
  app.selTools.push(function () { return app.nat('hasDaybook') ? '<button type="button" data-a="selDaybook" aria-label="Send to Daybook">' + app.ic('daybook') + '</button>' : ''; });
  A.selDaybook = function () {
    var sl = S.sel;
    if (!sl) return;
    var h = app.saveHighlight(null);
    var b = bookInfo(sl.ru.b.id);
    app.clearSel();
    if (h) sendHighlight(h, b);
  };

  // ---------------------------------------------------------------- export
  A.exportNotes = function () {
    var t = app.top(), now = Date.now(), md, name;
    if (t.id) { var b = bookInfo(t.id), d = app.bookDoc(t.id); md = L.notebookMarkdown(b, d.hl, d.bm, now); name = L.fileName(b.title + ' — notes') + '.md'; }
    else { md = L.allNotesMarkdown(allNotes(), now); name = 'Reading notes.md'; }
    app.call('saveText', [name, 'text/markdown', md]).then(function (r) {
      if (r && r.ok) app.snack('Saved ' + name);
      else if (r && r.error && r.error !== 'unavailable') app.snack(r.error);
    });
  };

  // a way into the notebook from the library
  app.libraryActions = (app.libraryActions || []).concat([function () { return app.icb('allNotes', app.ic('note'), 'All notes'); }]);
})();
