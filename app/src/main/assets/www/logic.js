/* Margin — reading logic that does not touch the screen: paragraphs and positions, text and
   Markdown books, and (added in later steps) recaps, names, flashcards and reading pace.
   Pure functions, so they run the same in the app and in the unit tests (node test/run.js). */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- paragraphs ("blocks")
  /* A block is an element that holds text of its own: p, h1–h6, li, blockquote, pre, td and so on.
     A block's own text is every text node whose nearest block ancestor is that element, so
     <div>a<p>b</p>c</div> gives two blocks: div ("ac") and p ("b"). Blocks are numbered in the order
     their first text appears. The reader, search, recaps and read-aloud all use this numbering,
     which makes a position {c: chapter, p: block, o: character} mean the same thing everywhere. */
  var BLOCK = { p: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, li: 1, dt: 1, dd: 1, blockquote: 1, pre: 1, figcaption: 1, caption: 1,
    td: 1, th: 1, div: 1, section: 1, article: 1, aside: 1, header: 1, footer: 1, address: 1, center: 1, nav: 1, figure: 1, main: 1,
    body: 1, table: 1, tr: 1, ul: 1, ol: 1, dl: 1, hgroup: 1, summary: 1, details: 1, legend: 1, fieldset: 1 };
  var SKIP = { script: 1, style: 1, noscript: 1, template: 1, head: 1, title: 1, svg: 1, math: 1, rp: 1 };

  function nameOf(el) { return (el.localName || el.nodeName || '').toLowerCase(); }
  function blockOf(node, body) {
    for (var el = node.parentNode; el && el !== body.parentNode; el = el.parentNode) {
      var n = nameOf(el);
      if (SKIP[n]) return null;
      if (BLOCK[n]) return el;
    }
    return null;
  }
  function bodyOf(doc) { return doc.body || (doc.getElementsByTagName ? doc.getElementsByTagName('body')[0] : null) || doc.documentElement; }

  /* Returns {els: [element], nodes: [[textNode...] per block], text: [own text per block]}.
     Works on any DOM: the reader's iframe document or a DOMParser document. */
  function blocks(doc) {
    var body = bodyOf(doc), els = [], nodes = [], text = [], index = new Map();
    if (!body) return { els: els, nodes: nodes, text: text };
    var w = doc.createTreeWalker(body, 4 /* SHOW_TEXT */, null);
    for (var t = w.nextNode(); t; t = w.nextNode()) {
      var b = blockOf(t, body);
      if (!b) continue;
      var i = index.get(b);
      if (i === undefined) {
        if (!/\S/.test(t.data)) continue; // a block starts at its first visible text
        i = els.length; index.set(b, i); els.push(b); nodes.push([]); text.push('');
      }
      nodes[i].push(t); text[i] += t.data;
    }
    return { els: els, nodes: nodes, text: text };
  }

  function clean(s) { return String(s || '').replace(/[\s ​]+/g, ' ').trim(); }

  /* DOM point for character o of block p: {node, offset}. */
  function pointAt(bl, p, o) {
    var list = bl.nodes[p];
    if (!list || !list.length) return null;
    var left = Math.max(0, o | 0);
    for (var i = 0; i < list.length; i++) {
      var len = list[i].data.length;
      if (left <= len) return { node: list[i], offset: left };
      left -= len;
    }
    var last = list[list.length - 1];
    return { node: last, offset: last.data.length };
  }
  /* Block and character for a DOM point; null when the point is outside every block. */
  function pointOf(bl, node, offset) {
    // A point in an element (not a text node) is turned into the nearest text node position.
    if (node && node.nodeType === 1) {
      var kids = node.childNodes, after = kids[offset];
      var probe = after || node;
      var doc = node.ownerDocument, w = doc.createTreeWalker(probe === node ? node : doc.documentElement, 4, null);
      if (after) {
        w.currentNode = after;
        var t = after.nodeType === 3 ? after : w.nextNode();
        if (t) { node = t; offset = 0; }
      } else {
        var last = null;
        for (var x = w.nextNode(); x; x = w.nextNode()) last = x;
        if (last) { node = last; offset = last.data.length; }
      }
    }
    for (var p = 0; p < bl.nodes.length; p++) {
      var list = bl.nodes[p], sum = 0;
      for (var i = 0; i < list.length; i++) {
        if (list[i] === node) return { p: p, o: sum + Math.min(offset, list[i].data.length) };
        sum += list[i].data.length;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- positions across a book
  /* chapterLens[c] = characters in chapter c (cleaned own text of its blocks). blockLens[c][p] likewise. */
  function lensOf(texts) { return texts.map(function (t) { return clean(t).length + 1; }); }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  /* Fraction of the book (0–1) at position pos, from per-chapter block lengths (array of arrays). */
  function fractionAt(pos, blockLens) {
    if (!blockLens || !blockLens.length) return 0;
    var total = 0, before = 0;
    for (var c = 0; c < blockLens.length; c++) {
      var cl = sum(blockLens[c] || []);
      if (c < pos.c) before += cl;
      else if (c === pos.c) {
        var bl = blockLens[c] || [];
        for (var p = 0; p < Math.min(pos.p || 0, bl.length); p++) before += bl[p];
        if (bl[pos.p]) before += Math.min(bl[pos.p], pos.o || 0);
      }
      total += cl;
    }
    return total ? Math.max(0, Math.min(1, before / total)) : 0;
  }
  /* The position at fraction f of the book: {c, p, o:0}. */
  function positionAt(f, blockLens) {
    var total = 0, c, p;
    for (c = 0; c < blockLens.length; c++) total += sum(blockLens[c] || []);
    var target = Math.max(0, Math.min(1, f)) * total, acc = 0;
    for (c = 0; c < blockLens.length; c++) {
      var bl = blockLens[c] || [], cl = sum(bl);
      if (acc + cl > target || c === blockLens.length - 1) {
        for (p = 0; p < bl.length; p++) {
          if (acc + bl[p] > target) return { c: c, p: p, o: 0 };
          acc += bl[p];
        }
        return { c: c, p: Math.max(0, bl.length - 1), o: 0 };
      }
      acc += cl;
    }
    return { c: 0, p: 0, o: 0 };
  }
  function comparePos(a, b) { return (a.c - b.c) || ((a.p || 0) - (b.p || 0)) || ((a.o || 0) - (b.o || 0)); }
  /* Characters from the start of the book to pos. */
  function charsBefore(pos, blockLens) {
    var n = 0;
    for (var c = 0; c < Math.min(pos.c, blockLens.length); c++) n += sum(blockLens[c] || []);
    var bl = blockLens[pos.c] || [];
    for (var p = 0; p < Math.min(pos.p || 0, bl.length); p++) n += bl[p];
    return n + Math.min(bl[pos.p] || 0, pos.o || 0);
  }

  // ---------------------------------------------------------------- plain text and Markdown books
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var HEADING = /^(?:(?:chapter|kapitel|book|bok|part|del|letter|brev|act|akt|stave|canto|section)\s+(?:[0-9]+|[ivxlcdm]+|[a-zåäö-]+)\b.*|[ivxlcdm]+\.?|[0-9]{1,3}\.?)$/i;

  /* Splits a plain-text book into chapters: [{title, paras:[...]}].
     Paragraphs are separated by blank lines; hard-wrapped lines are joined (Gutenberg style).
     A chapter starts at a short line that looks like a heading ("CHAPTER IV", "Kapitel 3",
     "II.") or is in capitals, standing alone after two or more blank lines. Very long books
     without headings are cut every ~40 paragraphs so each part stays quick to lay out. */
  function textChapters(text) {
    text = String(text || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    // Project Gutenberg wraps the book in a licence; keep only the book between the markers.
    var start = text.search(/^\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*$/im);
    if (start >= 0) text = text.slice(text.indexOf('\n', start) + 1);
    var end = text.search(/^\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/im);
    if (end >= 0) text = text.slice(0, end);
    var lines = text.split('\n'), paras = [], cur = [], blank = 0, pendingBlank = 0;
    function flush() {
      if (cur.length) { paras.push({ t: joinLines(cur), gap: pendingBlank }); cur = []; }
    }
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].replace(/\s+$/, '');
      if (!l.trim()) { if (cur.length) { flush(); } blank++; continue; }
      if (!cur.length) { pendingBlank = blank; }
      blank = 0;
      cur.push(l);
    }
    flush();
    var chapters = [], ch = null;
    paras.forEach(function (p, i) {
      var t = p.t.trim(), short = t.length <= 60 && t.indexOf('\n') < 0;
      var caps = short && /[A-ZÅÄÖ]/.test(t) && t === t.toUpperCase() && /[A-ZÅÄÖ]{3}/.test(t);
      var isHead = short && (p.gap >= 2 || i === 0) && (HEADING.test(t) || (caps && !/[!?,;:]["”’]?$/.test(t)));
      if (isHead || !ch || (ch.paras.length >= 40 && !chapters.some(function (c) { return c.head; }))) {
        // A heading straight after another (a book title, then "CHAPTER I") starts one chapter, not two.
        if (isHead && ch && !ch.paras.length && ch.head) { ch.heads = (ch.heads || []).concat([ch.title]); ch.title = t; return; }
        ch = { title: isHead ? t : (ch ? 'Part ' + (chapters.length + 1) : ''), paras: [], head: isHead };
        chapters.push(ch);
        if (isHead) return;
      }
      ch.paras.push(t);
    });
    chapters = chapters.filter(function (c) { return c.paras.length || c.title; });
    if (!chapters.length) chapters = [{ title: '', paras: [] }];
    chapters.forEach(function (c, i) { if (!c.title) c.title = chapters.length === 1 ? 'Text' : 'Part ' + (i + 1); if (!c.heads) c.heads = []; delete c.head; });
    return chapters;
  }
  function joinLines(lines) {
    // Keep line breaks for verse and indented blocks (short lines, all similar), join prose.
    var indented = lines.length > 1 && lines.every(function (l) { return /^\s{2,}/.test(l); });
    var shortish = lines.length > 2 && lines.every(function (l) { return l.trim().length < 48; });
    if (indented || shortish) return lines.map(function (l) { return l.trim(); }).join('\n');
    return lines.map(function (l) { return l.trim(); }).join(' ').replace(/(\w)- (\w)/g, function (m, a, b) { return a + b; }).replace(/ {2,}/g, ' ');
  }

  /* Small, safe Markdown: headings, paragraphs, emphasis, code, quotes, lists, rules and links
     (shown as text, never followed). Raw HTML is escaped, so it shows as text. */
  function markdown(md) {
    md = String(md || '').replace(/\r\n?/g, '\n');
    var out = [], lines = md.split('\n'), i = 0;
    function inline(s) {
      s = esc(s);
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, function (m, a, b) { return '<strong>' + (a || b) + '</strong>'; });
      s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^_\s][^_]*)_/g, '$1<em>$2</em>');
      s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '<span class="m-img">[$1]</span>');
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, '<a class="m-ext" data-ext="$2">$1</a>');
      return s;
    }
    while (i < lines.length) {
      var l = lines[i];
      if (!l.trim()) { i++; continue; }
      var h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);
      if (h) { out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
      if (/^```/.test(l)) {
        var code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
        i++; out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); continue;
      }
      if (/^(\*\s*\*\s*\*|-\s*-\s*-|_\s*_\s*_)[\s*_-]*$/.test(l)) { out.push('<hr/>'); i++; continue; }
      if (/^>\s?/.test(l)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
        out.push('<blockquote>' + markdown(q.join('\n')) + '</blockquote>'); continue;
      }
      var ul = /^\s*[-*+]\s+/, ol = /^\s*\d+[.)]\s+/;
      if (ul.test(l) || ol.test(l)) {
        var ordered = ol.test(l), items = [];
        while (i < lines.length && (ordered ? ol : ul).test(lines[i])) items.push('<li>' + inline(lines[i++].replace(ordered ? ol : ul, '')) + '</li>');
        out.push((ordered ? '<ol>' : '<ul>') + items.join('') + (ordered ? '</ol>' : '</ul>')); continue;
      }
      var para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>\s?|\s*[-*+]\s+|\s*\d+[.)]\s+)/.test(lines[i])) para.push(lines[i++].trim());
      if (!para.length) { para.push(lines[i++].trim()); }
      out.push('<p>' + inline(para.join(' ')) + '</p>');
    }
    return out.join('\n');
  }

  /* Splits Markdown into chapters at top-level headings (# or ##, whichever the document uses). */
  function markdownChapters(md) {
    md = String(md || '').replace(/\r\n?/g, '\n');
    var lines = md.split('\n'), hasH1 = lines.filter(function (l) { return /^#\s/.test(l); }).length;
    var level = hasH1 > 1 ? /^#\s+(.*)/ : /^##\s+(.*)/, chapters = [], cur = { title: '', lines: [] }, inCode = false;
    lines.forEach(function (l) {
      if (/^```/.test(l)) inCode = !inCode;
      var m = !inCode && level.exec(l);
      if (m && (cur.lines.join('').trim() || cur.title)) { chapters.push(cur); cur = { title: m[1].trim(), lines: [l] }; }
      else { if (m) cur.title = m[1].trim(); cur.lines.push(l); }
    });
    chapters.push(cur);
    return chapters.filter(function (c) { return c.lines.join('').trim(); }).map(function (c, i, all) {
      var t = c.title || (/^#\s+(.*)/m.exec(c.lines.join('\n')) || [])[1] || (all.length === 1 ? 'Text' : 'Part ' + (i + 1));
      return { title: t.replace(/[*_`]/g, ''), html: markdown(c.lines.join('\n')) };
    });
  }

  /* XHTML document for a generated chapter (text and Markdown books), with its own strict CSP. */
  function chapterDoc(title, bodyHtml, lang) {
    return '<!doctype html><html lang="' + esc(lang || 'en') + '"><head><meta charset="utf-8">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\' \'self\'; font-src \'self\'; img-src \'self\' data:">' +
      '<title>' + esc(title) + '</title></head><body>' + bodyHtml + '</body></html>';
  }
  function textChapterHtml(ch) {
    var h = (ch.heads || []).map(function (t) { return '<h1>' + esc(t) + '</h1>'; }).join('') +
      (ch.title && ch.title !== 'Text' && !/^Part \d+$/.test(ch.title) ? '<h2>' + esc(ch.title) + '</h2>' : '');
    return h + ch.paras.map(function (p) {
      return p.indexOf('\n') >= 0 ? '<p class="verse">' + esc(p).replace(/\n/g, '<br/>') + '</p>' : '<p>' + esc(p) + '</p>';
    }).join('');
  }

  // ---------------------------------------------------------------- PDF flowing text
  /* pages: [[{t, b:[l,t,r,b]}]] → paragraphs per page. Pieces are ordered in columns (left column
     first, top to bottom), lines are joined into paragraphs, and words broken with a hyphen at the
     end of a line are put back together. */
  function pdfParagraphs(pages) {
    return (pages || []).map(function (parts) {
      parts = (parts || []).filter(function (p) { return p && p.t && p.t.trim(); });
      if (!parts.length) return [];
      var width = Math.max.apply(null, parts.map(function (p) { return p.b ? p.b[2] : 0; })) || 1;
      var two = parts.length > 3 && parts.filter(function (p) { return p.b && p.b[2] < width * 0.55; }).length >= 2 &&
        parts.filter(function (p) { return p.b && p.b[0] > width * 0.45; }).length >= 2;
      var sorted = parts.slice().sort(function (a, b) {
        var ca = two && a.b && a.b[0] > width * 0.45 ? 1 : 0, cb = two && b.b && b.b[0] > width * 0.45 ? 1 : 0;
        return (ca - cb) || ((a.b ? a.b[1] : 0) - (b.b ? b.b[1] : 0)) || ((a.b ? a.b[0] : 0) - (b.b ? b.b[0] : 0));
      });
      var lines = [];
      sorted.forEach(function (p) { p.t.replace(/\r/g, '').split('\n').forEach(function (l) { lines.push(l); }); });
      return reflowLines(lines);
    });
  }
  function reflowLines(lines) {
    var out = [], cur = '';
    lines.forEach(function (raw, i) {
      var l = raw.replace(/\s+/g, ' ').trim();
      if (!l) { if (cur) { out.push(cur); cur = ''; } return; }
      if (/^\d{1,4}$/.test(l) && (i === 0 || i === lines.length - 1)) return; // page numbers
      if (!cur) { cur = l; return; }
      var endsSentence = /[.!?:”"’)]$/.test(cur), startsNew = /^[A-ZÅÄÖ0-9“"‘•–-]/.test(l);
      var shortPrev = cur.length - cur.lastIndexOf(' ') < 2;
      if (/[a-zåäö]-$/.test(cur) && /^[a-zåäö]/.test(l)) cur = cur.slice(0, -1) + l;
      else if (endsSentence && startsNew && (l.length < 40 || /^[•–-]/.test(l) || shortPrev)) { out.push(cur); cur = l; }
      else cur += ' ' + l;
    });
    if (cur) out.push(cur);
    return out;
  }

  // ---------------------------------------------------------------- formatting
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function minutes(m) {
    m = Math.max(0, Math.round(m));
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }
  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

  var api = {
    BLOCK: BLOCK, blocks: blocks, clean: clean, pointAt: pointAt, pointOf: pointOf,
    lensOf: lensOf, fractionAt: fractionAt, positionAt: positionAt, comparePos: comparePos, charsBefore: charsBefore,
    esc: esc, textChapters: textChapters, markdown: markdown, markdownChapters: markdownChapters, chapterDoc: chapterDoc, textChapterHtml: textChapterHtml,
    pdfParagraphs: pdfParagraphs, reflowLines: reflowLines,
    plural: plural, minutes: minutes, dayKey: dayKey,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Logic = api;
})(this);
