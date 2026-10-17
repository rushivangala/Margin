/* Unit tests for assets/www/logic.js (the parts that need no browser). Run: node test/run.js */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const L = require('../app/src/main/assets/www/logic.js');
const BOOKS = path.join(__dirname, '..', 'app/src/test/resources/books');

module.exports = {
  'positions: fraction and position are inverses'() {
    const lens = [[10, 10], [5, 5, 10], [20]];
    assert.strictEqual(L.fractionAt({ c: 0, p: 0, o: 0 }, lens), 0);
    assert.strictEqual(L.fractionAt({ c: 1, p: 0, o: 0 }, lens), 20 / 60);
    assert.strictEqual(L.fractionAt({ c: 1, p: 2, o: 5 }, lens), 35 / 60);
    assert.deepStrictEqual(L.positionAt(35 / 60, lens), { c: 1, p: 2, o: 0 });
    assert.deepStrictEqual(L.positionAt(1, lens), { c: 2, p: 0, o: 0 });
    assert.deepStrictEqual(L.positionAt(0, lens), { c: 0, p: 0, o: 0 });
    assert.strictEqual(L.charsBefore({ c: 2, p: 0, o: 4 }, lens), 44);
    assert.ok(L.comparePos({ c: 1, p: 2, o: 0 }, { c: 1, p: 1, o: 9 }) > 0);
    assert.strictEqual(L.fractionAt({ c: 0, p: 0 }, []), 0);
  },

  'text books: Gutenberg wrapping, headings and verse'() {
    const text = 'The Project Gutenberg eBook of X\n\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\n\n\n\nA TALE\n\n\n\nCHAPTER I.\n\nIt was a dark and stormy night; the rain fell in\ntorrents, except at occasional inter-\nvals.\n\nSecond paragraph.\n\n  Roses are red,\n  violets are blue.\n\n\n\nCHAPTER II.\n\nMorning came.\n\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nlicence text';
    const ch = L.textChapters(text);
    assert.strictEqual(ch.length, 2);
    assert.strictEqual(ch[0].title, 'CHAPTER I.');
    assert.deepStrictEqual(ch[0].heads, ['A TALE']);
    assert.strictEqual(ch[0].paras[0], 'It was a dark and stormy night; the rain fell in torrents, except at occasional intervals.');
    assert.strictEqual(ch[0].paras[2], 'Roses are red,\nviolets are blue.');
    assert.deepStrictEqual(ch[1].paras, ['Morning came.']);
    const html = L.textChapterHtml(ch[0]);
    assert.ok(html.startsWith('<h1>A TALE</h1><h2>CHAPTER I.</h2><p>It was'));
    assert.ok(html.includes('<p class="verse">Roses are red,<br/>violets are blue.</p>'));
    assert.ok(!/licence/.test(JSON.stringify(ch)), 'licence after END marker is dropped');
  },

  'text books: the test book and books without headings'() {
    const ch = L.textChapters(fs.readFileSync(path.join(BOOKS, 'plain.txt'), 'utf8'));
    assert.deepStrictEqual(ch.map((c) => c.title), ['THE KEEPER', 'THE LOGBOOK']);
    assert.deepStrictEqual(ch[0].heads, ['THE HARBOUR']);
    const long = Array.from({ length: 90 }, (_, i) => 'Paragraph ' + i + ' of a book with no headings.').join('\n\n');
    const parts = L.textChapters(long);
    assert.strictEqual(parts.length, 3);
    assert.strictEqual(parts[1].title, 'Part 2');
    assert.strictEqual(L.textChapters('').length, 1);
    assert.ok(L.textChapterHtml({ title: 'X', paras: ['a <b> & c'] }).includes('a &lt;b&gt; &amp; c'), 'text is escaped');
  },

  'markdown is safe and readable'() {
    const md = fs.readFileSync(path.join(BOOKS, 'notes.md'), 'utf8');
    const h = L.markdown(md);
    assert.ok(h.includes('<h1>Keeper’s notes</h1>'));
    assert.ok(h.includes('<strong>bold</strong>') && h.includes('<em>italic</em>') && h.includes('<code>code</code>'));
    assert.ok(h.includes('<ul><li>Wind the clockwork</li><li>Trim the wick</li></ul>'));
    assert.ok(h.includes('<ol><li>First</li><li>Second</li></ol>'));
    assert.ok(h.includes('<blockquote><p>The light must never go out.</p></blockquote>'));
    assert.ok(h.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'raw HTML escaped');
    assert.ok(!/<script/i.test(h));
    assert.ok(h.includes('<a class="m-ext" data-ext="https://example.org">A link</a>'));
    assert.ok(!/href=/.test(h), 'links never get an href');
    assert.ok(L.markdown('```\n<b>x</b>\n```').includes('<pre><code>&lt;b&gt;x&lt;/b&gt;</code></pre>'));
    assert.ok(!L.markdown('[x](javascript:alert(1))').includes('href'));
    const chs = L.markdownChapters('# One\n\ntext\n\n# Two\n\nmore\n\n```\n# not a heading\n```');
    assert.deepStrictEqual(chs.map((c) => c.title), ['One', 'Two']);
    assert.ok(chs[1].html.includes('# not a heading'));
  },

  'generated chapters carry their own CSP'() {
    const d = L.chapterDoc('T<i>', '<p>x</p>', 'sv');
    assert.ok(d.includes("default-src 'none'"));
    assert.ok(d.includes('<title>T&lt;i&gt;</title>'));
    assert.ok(d.includes('lang="sv"'));
  },

  'pdf text: columns, hyphens and page numbers'() {
    const pages = L.pdfParagraphs([[
      { t: 'Column two starts here and\ngoes on.', b: [320, 60, 560, 400] },
      { t: 'Title of the page', b: [40, 20, 560, 40] },
      { t: 'Column one has a hyphen-\nated word and con-\ntinues.', b: [40, 60, 280, 400] },
      { t: 'More of column one.', b: [40, 420, 280, 500] },
      { t: 'More of column two.', b: [320, 420, 560, 500] },
      { t: '12', b: [290, 780, 300, 790] },
    ]]);
    const text = pages[0].join(' | ');
    assert.ok(text.indexOf('Column one') < text.indexOf('Column two'), text);
    assert.ok(text.includes('hyphenated word and continues.'), text);
    assert.ok(!/\b12\b/.test(text), 'page number dropped: ' + text);
    assert.deepStrictEqual(L.reflowLines(['A line that ends', 'in the middle.', '', 'New para.']), ['A line that ends in the middle.', 'New para.']);
  },

  'formatting'() {
    assert.strictEqual(L.minutes(0), '0 min');
    assert.strictEqual(L.minutes(59.6), '1 h');
    assert.strictEqual(L.minutes(135), '2 h 15 min');
    assert.strictEqual(L.plural(1, 'book'), '1 book');
    assert.strictEqual(L.plural(2, 'book'), '2 books');
    assert.strictEqual(L.clean('  a   b\n'), 'a b');
  },

  'search: phrases first, then paragraphs with every word'() {
    const texts = [['The harbour smelled of tar and rain.', 'Rain on the tar roof of the harbour.'], ['Captain Rowe said “Grey Widow”.']];
    const r = L.searchBook(texts, 'harbour smelled');
    assert.strictEqual(r.length, 1);
    assert.deepStrictEqual([r[0].c, r[0].p, r[0].o, r[0].len, r[0].exact], [0, 0, 4, 15, true]);
    const loose = L.searchBook(texts, 'rain harbour');
    assert.deepStrictEqual(loose.map((x) => [x.c, x.p, x.exact]), [[0, 0, false], [0, 1, false]]);
    assert.strictEqual(L.searchBook(texts, 'grey widow')[0].snippet.hit, 'Grey Widow');
    assert.strictEqual(L.searchBook(texts, '"grey widow"').length, 1, 'curly and straight quotes match');
    assert.deepStrictEqual(L.searchBook(texts, '   '), []);
    const raw = '  The  harbour\n smelled ';
    assert.strictEqual(L.rawOffset(raw, L.clean(raw).indexOf('smelled')), raw.indexOf('smelled'));
    assert.strictEqual(L.wordCount([['Åsa sa: – Här är tjugo-två ord.']]), 6);
  },

  'notes: Daybook text and Markdown export'() {
    const book = { title: 'The Keeper', author: 'Ada Testwright' };
    const h1 = { c: 1, s: { p: 2, o: 0 }, e: { p: 2, o: 5 }, text: 'harbour smelled\nof tar', note: ' First impression. ', chapter: 'Chapter 1', color: 'green' };
    const h0 = { c: 0, s: { p: 0, o: 0 }, e: { p: 0, o: 3 }, text: 'Edith', note: '', chapter: 'Prologue', color: 'yellow' };
    assert.strictEqual(L.highlightText(h1, book), '> harbour smelled\n> of tar\n\nFirst impression.\n\n— The Keeper, Ada Testwright · Chapter 1\n#reading');
    const md = L.notebookMarkdown(book, [h1, h0], [{ chapter: 'Chapter 1', text: 'A bookmark text' }], new Date(2026, 9, 17).getTime());
    assert.ok(md.startsWith('# The Keeper\n\n*Ada Testwright*\n\n2 highlights · 1 note · exported from Margin on 2026-10-17\n'), md);
    assert.ok(md.indexOf('## Prologue') < md.indexOf('## Chapter 1'), 'reading order');
    assert.ok(md.includes('> harbour smelled\n> of tar\n\nFirst impression.\n\n<sub>Green</sub>'));
    assert.ok(md.includes('## Bookmarks\n\n- Chapter 1: “A bookmark text”'));
    const all = L.allNotesMarkdown([{ book, hl: [h0], bm: [] }, { book: { title: 'Empty' }, hl: [], bm: [] }]);
    assert.ok(all.startsWith('# Reading notes\n\n## The Keeper') && !all.includes('Empty'), all);
    assert.strictEqual(L.fileName('A/B: "C"?'), 'A B C');
  },
};
