/* Margin — the reading surface.

   Each chapter is shown in an <iframe sandbox="allow-same-origin"> — never allow-scripts — so
   nothing a book contains can run. The book's own files come from https://app.local/book/… with a
   strict Content-Security-Policy (no scripts, no network, no frames, no forms). Because the frame
   shares our origin, this file can still lay the chapter out, read the selection and paint
   highlights from the outside. Links are rewritten so none of them can leave the app.

   Paged mode lays the chapter out in CSS columns exactly one screen wide and moves by whole
   screens; scrolling mode lets the chapter scroll. Positions are {c: chapter, p: block, o: char}
   (see Logic.blocks), so a position means the same thing after a font change or rotation. */
(function (root) {
  'use strict';
  var L = root.Logic;
  var EPUB_NS = 'http://www.idpf.org/2007/ops';

  var FONTS = {
    book: '',
    literata: '"Literata", Georgia, serif',
    figtree: '"Figtree", system-ui, sans-serif',
    serif: 'Georgia, "Noto Serif", serif',
    mono: '"JetBrains Mono", monospace',
  };
  var FONT_FACES = '@font-face{font-family:"Literata";src:url("/fonts/literata-latin.woff2") format("woff2");font-weight:200 900;font-style:normal;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}' +
    '@font-face{font-family:"Literata";src:url("/fonts/literata-latin-italic.woff2") format("woff2");font-weight:200 900;font-style:italic;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}' +
    '@font-face{font-family:"Literata";src:url("/fonts/literata-latin-ext.woff2") format("woff2");font-weight:200 900;font-style:normal;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}' +
    '@font-face{font-family:"Literata";src:url("/fonts/literata-latin-ext-italic.woff2") format("woff2");font-weight:200 900;font-style:italic;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}' +
    '@font-face{font-family:"Figtree";src:url("/kit/fonts/figtree.woff2") format("woff2");font-weight:300 900}' +
    '@font-face{font-family:"JetBrains Mono";src:url("/kit/fonts/jetbrains-mono.woff2") format("woff2");font-weight:100 800}';

  var HL = ['yellow', 'green', 'blue', 'pink'];

  function Reader(host, cb) {
    this.host = host;
    this.cb = cb || {};
    this.s = { mode: 'paged', font: 'literata', size: 19, line: 1.55, margin: 24, justify: true, hyphens: true, colors: null, top: 24, bottom: 40 };
    this.book = null;
    this.c = -1;
    this.page = 0;
    this.pages = 1;
    this.bl = null;
    this.highlights = [];
    this.marks = {};
    this.frame = null;
    this.loadSeq = 0;
    this.ready = false;
    var self = this;
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () { self.relayoutSoon(); }) : null;
  }

  var R = Reader.prototype;

  /* book: {id, lang, chapters:[{src} | {html}]} */
  R.open = function (book, pos, settings) {
    this.book = book;
    if (settings) this.s = Object.assign(this.s, settings);
    this.c = -1;
    return this.show(pos && pos.c != null ? pos.c : 0, pos || null);
  };

  R.close = function () {
    if (this.ro) this.ro.disconnect();
    if (this.frame) this.frame.remove();
    this.frame = null;
    this.book = null;
    this.c = -1;
  };

  R.makeFrame = function () {
    var f = document.createElement('iframe');
    // allow-same-origin only: the app can reach into the chapter, the chapter can run nothing.
    f.setAttribute('sandbox', 'allow-same-origin');
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.setAttribute('title', 'Book page');
    f.className = 'rframe';
    this.host.innerHTML = '';
    this.host.appendChild(f);
    if (this.ro) { this.ro.disconnect(); this.ro.observe(this.host); }
    this.frame = f;
    return f;
  };

  /* Shows chapter c and goes to target: {p, o} | {frag} | {f: fraction of chapter} | 'end' | null (start). */
  R.show = function (c, target) {
    var self = this, book = this.book;
    if (!book) return Promise.resolve();
    c = Math.max(0, Math.min(book.chapters.length - 1, c));
    if (c === this.c && this.ready) { this.go(target); return Promise.resolve(); }
    var seq = ++this.loadSeq, ch = book.chapters[c];
    var f = this.frame && this.frame.isConnected ? this.frame : this.makeFrame();
    this.ready = false;
    f.style.visibility = 'hidden';
    return new Promise(function (resolve) {
      var tried = false;
      f.onload = function () {
        if (seq !== self.loadSeq) return;
        var doc = f.contentDocument;
        // A chapter that is not well-formed XML shows a parser error; serve it again as HTML.
        if (!tried && ch.src && doc && (doc.getElementsByTagName('parsererror').length || !doc.body)) {
          tried = true;
          f.src = ch.src + (ch.src.indexOf('?') < 0 ? '?' : '&') + 'html=1';
          return;
        }
        self.c = c;
        self.prepare(doc);
        // Lay out only once the reading font has loaded, or pages would be measured with the
        // fallback font and shift a moment later.
        void doc.documentElement.offsetHeight;
        var fontsReady = doc.fonts && doc.fonts.ready ? Promise.race([doc.fonts.ready, new Promise(function (r) { setTimeout(r, 1500); })]) : Promise.resolve();
        fontsReady.then(function () {
          if (seq !== self.loadSeq) return;
          self.layout();
          self.go(target);
          self.ready = true;
          f.style.visibility = '';
          if (doc.fonts) doc.fonts.addEventListener('loadingdone', function () { if (self.doc === doc) self.relayoutSoon(); });
          if (self.cb.onLoad) self.cb.onLoad(c);
          resolve();
        });
      };
      if (ch.html != null) { f.removeAttribute('src'); f.srcdoc = ch.html; }
      else { f.removeAttribute('srcdoc'); f.src = ch.src; }
    });
  };

  // ---------------------------------------------------------------- preparing a chapter

  R.prepare = function (doc) {
    var self = this;
    this.doc = doc;
    this.win = doc.defaultView;
    var html = doc.documentElement;
    if (this.book.lang && !html.getAttribute('lang') && !html.getAttribute('xml:lang')) html.setAttribute('lang', this.book.lang);
    // Nothing in the chapter may go anywhere: rewrite every link, drop forms and embedded frames.
    Array.prototype.forEach.call(doc.querySelectorAll('a[href], area[href]'), function (a) {
      var href = a.getAttribute('href');
      a.removeAttribute('href');
      a.removeAttribute('target');
      a.setAttribute('role', 'link');
      a.setAttribute('tabindex', '0');
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^https:\/\/app\.local\//i.test(href)) { a.setAttribute('data-ext', href); a.classList.add('m-ext'); }
      else a.setAttribute('data-to', href);
      var type = a.getAttributeNS(EPUB_NS, 'type') || a.getAttribute('epub:type') || '';
      if (/noteref/.test(type) || (a.closest && a.closest('sup') && a.textContent.trim().length <= 4)) a.setAttribute('data-note', '1');
    });
    Array.prototype.forEach.call(doc.querySelectorAll('form, iframe, frame, object, embed, base, meta[http-equiv]'), function (el) {
      if (el.localName === 'form') { el.setAttribute('onsubmit', ''); el.removeAttribute('action'); } else el.remove();
    });
    var st = doc.createElementNS('http://www.w3.org/1999/xhtml', 'style');
    st.id = 'margin-style';
    (doc.head || html).appendChild(st);
    this.styleEl = st;
    this.applyStyle();
    this.bl = L.blocks(doc);
    this.listen(doc);
  };

  R.css = function () {
    var s = this.s, c = s.colors || {}, font = FONTS[s.font] || '';
    var W = this.host.clientWidth || 360, H = this.host.clientHeight || 640;
    var M = Math.round(s.margin), T = Math.round(s.top), B = Math.round(s.bottom);
    var css = '@namespace epub "' + EPUB_NS + '";' + FONT_FACES;
    // The frame must use the same colour scheme as the app, or Chromium paints it an opaque white.
    css += ':root{color-scheme:' + (s.dark ? 'dark' : 'light') + ' !important}';
    css += 'html{font-size:' + s.size + 'px !important;-webkit-text-size-adjust:none;text-size-adjust:none;background:transparent !important;color:' + (c.ink || 'inherit') + ' !important;' +
      'hyphens:' + (s.hyphens ? 'auto' : 'manual') + ';-webkit-hyphens:' + (s.hyphens ? 'auto' : 'manual') + ';}';
    css += 'body{margin:0 !important;padding:0 !important;background:transparent !important;line-height:' + s.line + ' !important;' + (font ? 'font-family:' + font + ' !important;' : '') +
      'overflow-wrap:break-word;-webkit-user-select:text;user-select:text;max-width:none !important;}';
    css += 'body p,body li,body dd,body blockquote,body div{line-height:inherit !important;' + (s.justify ? 'text-align:justify;' : '') + '}';
    css += 'body h1,body h2,body h3,body h4,body h5,body h6{text-align:center;line-height:1.25 !important;break-after:avoid;hyphens:manual}';
    if (c.ink) css += 'body *{color:inherit !important;background-color:transparent !important;border-color:' + (c.muted || 'currentColor') + ' !important}';
    if (font) css += 'body *:not(pre):not(code):not(kbd):not(samp){font-family:inherit !important}';
    css += 'a[data-to],a[data-ext]{color:' + (c.link || 'inherit') + ' !important;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px;cursor:pointer}';
    css += 'a[data-note]{text-decoration:none;font-weight:600}';
    css += 'img,svg,video,canvas{max-width:100% !important;height:auto;object-fit:contain;break-inside:avoid}';
    css += 'pre{white-space:pre-wrap !important;font-size:.85em}';
    css += 'table{max-width:100%;border-collapse:collapse} td,th{padding:2px 6px}';
    css += 'aside[epub|type~="footnote"],aside[epub|type~="endnote"],aside[epub|type~="rearnote"],aside[epub|type~="note"]{display:none}';
    css += 'p.verse{text-align:left !important;text-indent:0 !important}';
    css += '::selection{background:' + (c.sel || 'rgba(120,140,200,.35)') + '}';
    HL.forEach(function (h) { css += '::highlight(mh-' + h + '){background-color:' + ((c.hl && c.hl[h]) || 'rgba(250,210,60,.45)') + ';color:inherit}'; });
    css += '::highlight(mh-note){text-decoration:underline dotted;text-decoration-thickness:2px;text-underline-offset:3px;text-decoration-color:' + (c.pri || '#d65d0e') + '}';
    css += '::highlight(mh-tts){background-color:' + (c.tts || 'rgba(120,180,220,.35)') + '}';
    css += '::highlight(mh-find){background-color:' + (c.find || 'rgba(250,150,60,.55)') + '}';
    if (s.mode === 'paged') {
      var colW = Math.max(120, W - 2 * M);
      css += 'html{height:' + H + 'px !important;width:' + W + 'px !important;max-width:none !important;margin:0 !important;overflow:hidden !important;box-sizing:border-box !important;' +
        'padding:' + T + 'px ' + M + 'px ' + B + 'px ' + M + 'px !important;column-width:' + colW + 'px !important;column-gap:' + (2 * M) + 'px !important;column-fill:auto !important;column-count:auto !important}';
      css += 'img,svg,video{max-height:' + Math.max(80, H - T - B - 8) + 'px !important}';
    } else {
      css += 'html{margin:0 !important;overflow-x:hidden !important;overflow-y:auto !important;scrollbar-width:none;padding:' + T + 'px ' + M + 'px ' + (B + 80) + 'px ' + M + 'px !important;box-sizing:border-box}';
      css += 'html::-webkit-scrollbar{display:none}';
    }
    return css;
  };

  R.applyStyle = function () {
    if (this.styleEl) this.styleEl.textContent = this.css();
  };

  /* New settings (font, size, margins, mode, colours): keep the reader on the same paragraph. */
  R.configure = function (s) {
    // Several changes in a row (A+ A+ A+) keep the first anchor, so the page never drifts back.
    var pos = this.ready ? (this.keep || this.position()) : null;
    this.s = Object.assign(this.s, s);
    if (!this.ready) return;
    this.applyStyle();
    this.layout();
    this.configuring = true;
    if (pos) this.go(pos);
    this.configuring = false;
    this.keep = pos;
    this.paint();
  };

  R.relayoutSoon = function () {
    var self = this;
    clearTimeout(this.rt);
    this.rt = setTimeout(function () { if (self.ready) self.configure({}); }, 120);
  };

  R.layout = function () {
    if (!this.doc) return;
    var W = this.host.clientWidth || 1, doc = this.doc, old = doc.getElementById('margin-spacer');
    if (old) old.remove();
    if (this.s.mode === 'paged') {
      // Chromium leaves the end padding of the last column out of the scroll width, so the last
      // page could not scroll fully into place. A 1px spacer at the end of the last page fixes that.
      var M = Math.round(this.s.margin), sw = doc.documentElement.scrollWidth;
      this.pages = Math.max(1, Math.ceil((sw + M - 2) / W));
      var sp = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      sp.id = 'margin-spacer';
      sp.setAttribute('aria-hidden', 'true');
      sp.style.cssText = 'position:absolute !important;top:0;left:' + (this.pages * W - 1) + 'px;width:1px;height:1px;visibility:hidden';
      doc.documentElement.appendChild(sp);
    } else this.pages = 1;
  };

  // ---------------------------------------------------------------- moving around

  R.go = function (target) {
    if (!this.doc) return;
    var W = this.host.clientWidth || 1, win = this.win;
    if (this.s.mode === 'paged') {
      var page = 0;
      if (target === 'end') page = this.pages - 1;
      else if (target && target.f != null) page = Math.floor(target.f * this.pages);
      else if (target) {
        var r = this.rectOf(target);
        if (r) page = Math.floor((r.left + win.scrollX + 1) / W);
      }
      this.setPage(page);
    } else {
      var y = 0, H = this.host.clientHeight;
      if (target === 'end') y = this.doc.documentElement.scrollHeight;
      else if (target && target.f != null) y = target.f * this.doc.documentElement.scrollHeight;
      else if (target) {
        var rr = this.rectOf(target);
        if (rr) y = rr.top + win.scrollY - this.s.top - 4;
      }
      win.scrollTo(0, Math.max(0, y));
      this.page = 0;
      this.report();
      void H;
    }
  };

  /* Screen rectangle of a position: {p, o} or {frag}. */
  R.rectOf = function (t) {
    var doc = this.doc;
    if (t.frag) {
      var el = doc.getElementById(t.frag) || doc.querySelector('[name="' + String(t.frag).replace(/["\\]/g, '') + '"]');
      return el ? el.getBoundingClientRect() : null;
    }
    if (t.p == null || !this.bl.els.length) return null;
    var p = Math.min(t.p, this.bl.els.length - 1), pt = L.pointAt(this.bl, p, t.o || 0);
    if (!pt) return this.bl.els[p].getBoundingClientRect();
    var r = doc.createRange();
    r.setStart(pt.node, pt.offset);
    r.setEnd(pt.node, Math.min(pt.node.data.length, pt.offset + 1));
    var rects = r.getClientRects();
    return rects.length ? rects[0] : this.bl.els[p].getBoundingClientRect();
  };

  R.setPage = function (n) {
    var W = this.host.clientWidth || 1;
    this.page = Math.max(0, Math.min(this.pages - 1, n));
    this.win.scrollTo(this.page * W, 0);
    this.report();
  };

  R.next = function () {
    if (!this.ready) return;
    if (this.s.mode === 'paged') {
      if (this.page < this.pages - 1) this.setPage(this.page + 1);
      else if (this.c < this.book.chapters.length - 1) this.show(this.c + 1, null);
      else if (this.cb.onEnd) this.cb.onEnd();
    } else {
      var win = this.win, H = this.host.clientHeight, max = this.doc.documentElement.scrollHeight - H;
      if (win.scrollY < max - 2) win.scrollTo(0, Math.min(max, win.scrollY + H - this.s.top - this.s.bottom - 24));
      else if (this.c < this.book.chapters.length - 1) this.show(this.c + 1, null);
      else if (this.cb.onEnd) this.cb.onEnd();
    }
  };

  R.prev = function () {
    if (!this.ready) return;
    if (this.s.mode === 'paged') {
      if (this.page > 0) this.setPage(this.page - 1);
      else if (this.c > 0) this.show(this.c - 1, 'end');
    } else {
      var win = this.win, H = this.host.clientHeight;
      if (win.scrollY > 2) win.scrollTo(0, Math.max(0, win.scrollY - (H - this.s.top - this.s.bottom - 24)));
      else if (this.c > 0) this.show(this.c - 1, 'end');
    }
  };

  /* Where the reader is: the first character on the screen. */
  R.position = function () {
    if (!this.doc || !this.bl) return { c: Math.max(0, this.c), p: 0, o: 0 };
    var s = this.s, doc = this.doc, W = this.host.clientWidth, x0 = s.margin + 1, y0 = s.top + 2;
    var probes = [[x0, y0], [x0 + 20, y0 + 10], [W / 2, y0 + 24], [x0, y0 + 60], [W / 2, (this.host.clientHeight || 600) / 3]];
    for (var i = 0; i < probes.length; i++) {
      var r = doc.caretRangeFromPoint ? doc.caretRangeFromPoint(probes[i][0], probes[i][1]) : null;
      if (!r) continue;
      var pt = L.pointOf(this.bl, r.startContainer, r.startOffset);
      if (pt) return { c: this.c, p: pt.p, o: pt.o };
    }
    // fall back to the first block that shows on screen
    for (var p = 0; p < this.bl.els.length; p++) {
      var rects = this.bl.els[p].getClientRects();
      for (var k = 0; k < rects.length; k++) {
        var q = rects[k];
        if (q.right > 0 && q.left < W && q.bottom > 0 && q.top < this.host.clientHeight) return { c: this.c, p: p, o: 0 };
      }
    }
    return { c: this.c, p: 0, o: 0 };
  };

  /* The last fully visible block on screen (for "read to here" and session ends). */
  R.endPosition = function () {
    if (!this.doc || !this.bl) return this.position();
    var W = this.host.clientWidth, H = this.host.clientHeight, last = null;
    for (var p = 0; p < this.bl.els.length; p++) {
      var rects = this.bl.els[p].getClientRects(), on = false;
      for (var k = 0; k < rects.length; k++) if (rects[k].right > 0 && rects[k].left < W && rects[k].bottom > 0 && rects[k].top < H) on = true;
      if (on) last = p; else if (last != null) break;
    }
    return { c: this.c, p: last == null ? 0 : last, o: 0 };
  };

  /* Fraction of the current chapter that is behind the reader. */
  R.chapterFraction = function () {
    if (!this.doc) return 0;
    if (this.s.mode === 'paged') return this.pages > 1 ? this.page / (this.pages - 1) : 1;
    var max = this.doc.documentElement.scrollHeight - this.host.clientHeight;
    return max > 0 ? Math.min(1, this.win.scrollY / max) : 1;
  };

  R.report = function () {
    if (!this.configuring) this.keep = null;
    if (this.cb.onPosition) this.cb.onPosition(this.position(), { page: this.page, pages: this.pages, chapterFraction: this.chapterFraction() });
  };

  // ---------------------------------------------------------------- touch, links, selection

  R.listen = function (doc) {
    var self = this, win = doc.defaultView, start = null, lastTap = 0;
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-to], a[data-ext], a[data-note], [data-ext]');
      e.preventDefault();
      if (!a) return;
      e.stopPropagation();
      self.link(a);
    }, true);
    doc.addEventListener('submit', function (e) { e.preventDefault(); }, true);
    doc.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { start = null; return; }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), sel: !win.getSelection().isCollapsed };
    }, { passive: true });
    doc.addEventListener('touchend', function (e) {
      if (!start || e.changedTouches.length !== 1) return;
      var t = e.changedTouches[0], dx = t.clientX - start.x, dy = t.clientY - start.y, dt = Date.now() - start.t, st = start;
      start = null;
      var selNow = !win.getSelection().isCollapsed;
      if (st.sel || selNow) { if (st.sel && Math.abs(dx) < 8 && Math.abs(dy) < 8 && dt < 400) { win.getSelection().removeAllRanges(); if (self.cb.onSelect) self.cb.onSelect(null); } return; }
      if (self.s.mode === 'paged' && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 800) {
        if (dx < 0) self.next(); else self.prev();
        return;
      }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 450) {
        var el = doc.elementFromPoint(t.clientX, t.clientY);
        if (el && el.closest && el.closest('a[data-to], a[data-ext], [data-ext]')) return; // the click handler takes links
        var hl = self.highlightAt(t.clientX, t.clientY);
        if (hl && self.cb.onHighlight) { self.cb.onHighlight(hl, self.toHost(self.rangeFor(hl).getBoundingClientRect())); return; }
        var now = Date.now();
        if (now - lastTap < 280) return;
        lastTap = now;
        var W = self.host.clientWidth, x = t.clientX - (self.s.mode === 'paged' ? 0 : 0);
        var zone = x < W * 0.28 ? 'prev' : x > W * 0.72 ? 'next' : 'menu';
        if (self.cb.onTap) self.cb.onTap(zone, t.clientX, t.clientY);
      }
    }, { passive: true });
    // Mouse (and tests): a click without a touch is a tap too.
    doc.addEventListener('mouseup', function (e) {
      if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      if (!win.getSelection().isCollapsed) return;
      var el = doc.elementFromPoint(e.clientX, e.clientY);
      if (el && el.closest && el.closest('a[data-to], a[data-ext], [data-ext]')) return;
      var hl = self.highlightAt(e.clientX, e.clientY);
      if (hl && self.cb.onHighlight) { self.cb.onHighlight(hl, self.toHost(self.rangeFor(hl).getBoundingClientRect())); return; }
      var W = self.host.clientWidth, zone = e.clientX < W * 0.28 ? 'prev' : e.clientX > W * 0.72 ? 'next' : 'menu';
      if (self.cb.onTap) self.cb.onTap(zone, e.clientX, e.clientY);
    });
    var selT = null;
    doc.addEventListener('selectionchange', function () {
      clearTimeout(selT);
      selT = setTimeout(function () { if (self.doc === doc) self.selectionChanged(); }, 220);
    });
    if (this.s.mode !== 'paged') {
      var scT = null;
      win.addEventListener('scroll', function () {
        clearTimeout(scT);
        scT = setTimeout(function () { if (self.doc === doc) self.report(); }, 150);
      }, { passive: true });
    }
    doc.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  R.toHost = function (r) {
    var hr = this.frame.getBoundingClientRect();
    return { left: r.left + hr.left, top: r.top + hr.top, right: r.right + hr.left, bottom: r.bottom + hr.top, width: r.width, height: r.height };
  };

  R.selectionChanged = function () {
    var sel = this.win.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { if (this.cb.onSelect) this.cb.onSelect(null); return; }
    var a = this.anchorOf(sel.getRangeAt(0));
    if (!a) { if (this.cb.onSelect) this.cb.onSelect(null); return; }
    if (this.cb.onSelect) this.cb.onSelect(a, this.toHost(sel.getRangeAt(0).getBoundingClientRect()));
  };

  /* An anchor for a DOM range: {c, s:{p,o}, e:{p,o}, text, context}. */
  R.anchorOf = function (range) {
    var s = L.pointOf(this.bl, range.startContainer, range.startOffset), e = L.pointOf(this.bl, range.endContainer, range.endOffset);
    if (!s || !e) return null;
    var text = L.clean(range.toString());
    if (!text) return null;
    var block = L.clean(this.bl.text[s.p] || '');
    return { c: this.c, s: s, e: e, text: text.slice(0, 4000), context: block.slice(0, 600) };
  };

  R.rangeFor = function (a) {
    var doc = this.doc, s = L.pointAt(this.bl, a.s.p, a.s.o), e = L.pointAt(this.bl, a.e.p, a.e.o), r = doc.createRange();
    if (!s || !e) return r;
    r.setStart(s.node, s.offset);
    r.setEnd(e.node, e.offset);
    return r;
  };

  R.clearSelection = function () {
    try { this.win.getSelection().removeAllRanges(); } catch (e) {}
  };

  /* The word under a point (for long-press definitions and read-aloud from here). */
  R.wordAt = function (x, y) {
    var r = this.doc.caretRangeFromPoint(x, y);
    if (!r || r.startContainer.nodeType !== 3) return null;
    var t = r.startContainer.data, i = r.startOffset, a = i, b = i;
    while (a > 0 && /[\p{L}\p{M}'’-]/u.test(t[a - 1])) a--;
    while (b < t.length && /[\p{L}\p{M}'’-]/u.test(t[b])) b++;
    return a < b ? t.slice(a, b) : null;
  };

  // ---------------------------------------------------------------- links and footnotes

  R.link = function (a) {
    var ext = a.getAttribute('data-ext');
    if (ext) { if (this.cb.onExternal) this.cb.onExternal(ext); return; }
    var to = a.getAttribute('data-to') || '', self = this;
    var target = this.resolve(to);
    if (!target) return;
    var isNote = a.getAttribute('data-note') === '1';
    if (target.c === this.c) {
      var el = target.frag ? this.doc.getElementById(target.frag) : null;
      if (el && (isNote || isNoteEl(el)) && this.cb.onNote) { this.cb.onNote(noteText(el), this.toHost(a.getBoundingClientRect()), target); return; }
      this.jump(target);
      return;
    }
    if (isNote && target.frag && this.cb.onNote && this.book.chapters[target.c].src) {
      fetch(this.book.chapters[target.c].src).then(function (r) { return r.text(); }).then(function (t) {
        var d = new DOMParser().parseFromString(t, 'application/xhtml+xml');
        if (d.getElementsByTagName('parsererror').length) d = new DOMParser().parseFromString(t, 'text/html');
        var el = d.getElementById(target.frag);
        if (el) self.cb.onNote(noteText(el), self.toHost(a.getBoundingClientRect()), target); else self.jump(target);
      }).catch(function () { self.jump(target); });
      return;
    }
    this.jump(target);
  };

  function isNoteEl(el) {
    var t = (el.getAttributeNS && el.getAttributeNS(EPUB_NS, 'type')) || el.getAttribute('epub:type') || '';
    if (/footnote|endnote|rearnote|note/.test(t)) return true;
    var p = el.closest && el.closest('aside, [class*="note"], [id*="note"], [id*="fn"]');
    return !!p && L.clean(el.textContent).length < 1200;
  }
  function noteText(el) {
    var host = el.closest && el.closest('aside, li') || el;
    var t = L.clean(host.textContent).replace(/\s*↩\s*$/, '');
    return t.slice(0, 1500);
  }

  /* "chapter2.xhtml#n3" relative to the current chapter → {c, frag}. */
  R.resolve = function (href) {
    var book = this.book, cur = book.chapters[this.c];
    var hash = href.indexOf('#'), path = hash >= 0 ? href.slice(0, hash) : href, frag = hash >= 0 ? decodeURIComponent(href.slice(hash + 1)) : '';
    if (!path) return { c: this.c, frag: frag };
    if (!cur.path) return null;
    var full = normalize(dirOf(cur.path) + decodeURIComponent(path.split('?')[0]));
    for (var i = 0; i < book.chapters.length; i++) if (book.chapters[i].path === full) return { c: i, frag: frag };
    return null;
  };

  R.jump = function (target) {
    if (this.cb.onJump) this.cb.onJump(this.position());
    if (target.c === this.c) this.go(target.frag ? { frag: target.frag } : null);
    else this.show(target.c, target.frag ? { frag: target.frag } : null);
  };

  function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); }
  function normalize(p) {
    var out = [];
    p.split('/').forEach(function (s) { if (!s || s === '.') return; if (s === '..') out.pop(); else out.push(s); });
    return out.join('/');
  }

  // ---------------------------------------------------------------- highlights (CSS Custom Highlight API: the DOM is never changed)

  R.setHighlights = function (list) {
    this.highlights = list || [];
    this.paint();
  };

  R.paint = function () {
    var win = this.win;
    if (!win || !win.CSS || !win.CSS.highlights || !win.Highlight) return;
    var self = this, groups = {};
    HL.forEach(function (h) { groups[h] = []; });
    groups.note = [];
    this.highlights.forEach(function (h) {
      if (h.c !== self.c) return;
      var r = self.rangeFor(h);
      if (r.collapsed) return;
      (groups[h.color] || groups.yellow).push(r);
      if (h.note) groups.note.push(r);
    });
    Object.keys(groups).forEach(function (k) {
      if (groups[k].length) win.CSS.highlights.set('mh-' + k, new win.Highlight(...groups[k]));
      else win.CSS.highlights.delete('mh-' + k);
    });
    Object.keys(this.marks).forEach(function (k) { self.mark(k, self.marks[k]); });
  };

  /* Temporary marks: 'tts' (sentence being read), 'find' (search hits). anchors: [{s,e}] in this chapter. */
  R.mark = function (name, anchors) {
    var win = this.win;
    this.marks[name] = anchors || [];
    if (!win || !win.CSS || !win.CSS.highlights || !win.Highlight) return;
    var self = this, ranges = (anchors || []).filter(function (a) { return a.c == null || a.c === self.c; }).map(function (a) { return self.rangeFor(a); });
    if (ranges.length) win.CSS.highlights.set('mh-' + name, new win.Highlight(...ranges)); else win.CSS.highlights.delete('mh-' + name);
  };

  R.highlightAt = function (x, y) {
    if (!this.highlights.length || !this.doc.caretRangeFromPoint) return null;
    var p = this.doc.caretRangeFromPoint(x, y);
    if (!p) return null;
    for (var i = this.highlights.length - 1; i >= 0; i--) {
      var h = this.highlights[i];
      if (h.c !== this.c) continue;
      var r = this.rangeFor(h);
      try { if (!r.collapsed && r.isPointInRange(p.startContainer, p.startOffset) && p.startOffset !== r.endOffset) return h; } catch (e) {}
    }
    return null;
  };

  /* Whether an anchor is on the current screen (to bring a read-aloud sentence into view). */
  R.isVisible = function (a) {
    var r = this.rangeFor(a).getBoundingClientRect(), W = this.host.clientWidth, H = this.host.clientHeight;
    return r.right > 0 && r.left < W && r.top >= 0 && r.bottom <= H;
  };

  /* Block index of the element with this id (for "which section of the contents am I in"). */
  R.blockOfFrag = function (frag) {
    if (!this.doc || !frag) return 0;
    this.fragCache = this.fragCache && this.fragCache.doc === this.doc ? this.fragCache : { doc: this.doc };
    if (this.fragCache[frag] != null) return this.fragCache[frag];
    var el = this.doc.getElementById(frag), idx = 0;
    if (el) {
      for (var p = 0; p < this.bl.els.length; p++) {
        var b = this.bl.els[p];
        if (b === el || el.contains(b) || (el.compareDocumentPosition(b) & 4)) { idx = p; break; }
      }
    }
    return (this.fragCache[frag] = idx);
  };

  R.blockTexts = function () { return this.bl ? this.bl.text.map(L.clean) : []; };

  root.Reader = Reader;
  Reader.HL = HL;
  Reader.FONTS = FONTS;
})(this);
