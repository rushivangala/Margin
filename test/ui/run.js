/* UI tests: the real interface in headless Chromium at Pixel 10 Pro size, with window.Native mocked
   (mock-native.js) and the app's routes served by server.js over the test books.

   node test/ui/run.js            all scenarios, light and dark
   node test/ui/run.js reader     only scenarios whose name contains "reader"
   Screenshots go to test/ui/out/. Needs Playwright with Chromium and a JDK (for the Java helper). */
'use strict';
const path = require('path');
const fs = require('fs');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const { start } = require('./server');

const OUT = path.join(__dirname, 'out');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-native.js'), 'utf8');
const only = process.argv.slice(2);
const results = [];
let failures = 0;

function check(cond, msg) {
  if (!cond) throw new Error('Expected: ' + msg);
}

async function newPage(browser, port, scheme, extra) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: scheme });
  const page = await ctx.newPage();
  const evil = [];
  const errors = [];
  // A request counts as leaving the app only if it was really sent: CSP-blocked attempts never reach the network.
  page.on('requestfinished', (r) => { if (!r.url().startsWith('http://127.0.0.1:' + port)) evil.push(r.url()); });
  page.on('requestfailed', (r) => { const f = (r.failure() || {}).errorText || ''; if (!r.url().startsWith('http://127.0.0.1:' + port) && !/BLOCKED_BY_CSP|ERR_ABORTED|BLOCKED_BY_RESPONSE|csp/i.test(f)) evil.push(r.url() + ' (' + f + ')'); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Content Security Policy|Blocked script execution|Failed to load resource|ERR_BLOCKED|net::ERR/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await page.addInitScript(MOCK + (extra || ''));
  await page.addInitScript(`if(window.top===window)try{localStorage.setItem('kit.appearance', JSON.stringify({mode:'${scheme}',light:'paper',dark:'gruvbox',dyn:false}))}catch(e){}`);
  await page.goto('http://127.0.0.1:' + port + '/');
  await page.waitForFunction(() => window.app && window.app.S && window.app.S.loaded);
  return { ctx, page, evil, errors };
}

async function shot(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
}

const frame = (page) => page.frame({ url: /\/book\/|about:srcdoc/ }) || page.frames()[1];
async function bookId(page, title) { return page.evaluate((t) => window.app.S.books.find((b) => b.title === t).id, title); }
async function openBook(page, title) {
  const id = await bookId(page, title);
  await page.evaluate((i) => window.app.openBook(i), id);
  await page.waitForFunction(() => window.app.S.reader && window.app.S.reader.r && window.app.S.reader.r.ready, null, { timeout: 8000 });
  await page.waitForTimeout(200);
  return id;
}
async function tapReader(page, x, y) {
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(350);
}

const scenarios = {
  // Logic.blocks and positions on real DOMs (the parts node can't test without a browser)
  async 'logic dom'(b, port) {
    const { page, ctx } = await newPage(b, port, 'light');
    const r = await page.evaluate(() => {
      const L = window.Logic;
      const d = new DOMParser().parseFromString('<html xmlns="http://www.w3.org/1999/xhtml"><body><div>a <p>Bee <i>sting</i></p> c</div><ul><li>one</li><li> </li></ul><script>x</script><table><tr><td>cell</td></tr></table></body></html>', 'application/xhtml+xml');
      const bl = L.blocks(d);
      const pt = L.pointAt(bl, 1, 5);
      const back = L.pointOf(bl, pt.node, pt.offset);
      return { texts: bl.text, back, frac: L.fractionAt({ c: 1, p: 1, o: 0 }, [[10, 10], [10, 10]]), pos: L.positionAt(0.6, [[10, 10], [10, 10]]) };
    });
    check(JSON.stringify(r.texts) === JSON.stringify(['a  c', 'Bee sting', 'one', 'cell']), 'blocks ' + JSON.stringify(r.texts));
    check(r.back.p === 1 && r.back.o === 5, 'pointOf inverts pointAt ' + JSON.stringify(r.back));
    check(r.frac === 0.75, 'fractionAt ' + r.frac);
    check(r.pos.c === 1 && r.pos.p === 0, 'positionAt ' + JSON.stringify(r.pos));
    await ctx.close();
  },

  async 'library'(b, port, scheme) {
    const { page, ctx, errors } = await newPage(b, port, scheme);
    await page.click('[data-a="filter"][data-v="all"]');
    await page.waitForTimeout(400);
    await shot(page, 'library-all-' + scheme);
    const n = await page.$$eval('.bk', (els) => els.length);
    check(n === 8, 'eight books on the All shelf, got ' + n);
    await page.click('[data-a="filter"][data-v="toread"]');
    await shot(page, 'library-toread-' + scheme);
    // long-press opens the book sheet
    await page.click('.bk', { button: 'right' });
    await page.waitForSelector('.k-sheet');
    await shot(page, 'book-sheet-' + scheme);
    check(!errors.length, 'no page errors: ' + errors.join(' | '));
    await ctx.close();
  },

  async 'reader epub3'(b, port, scheme) {
    const { page, ctx, errors, evil } = await newPage(b, port, scheme);
    const id = await openBook(page, 'The Keeper of Harwick Light');
    await shot(page, 'reader-page1-' + scheme);
    const f = frame(page);
    check(await f.evaluate(() => document.body.textContent.includes('Edith Marlow')), 'chapter 1 text shown');
    const before = await page.evaluate(() => window.app.S.reader.r.page);
    const pages = await page.evaluate(() => window.app.S.reader.r.pages);
    check(pages >= 2, 'chapter spans several pages, got ' + pages);
    await tapReader(page, 380, 450);
    const after = await page.evaluate(() => window.app.S.reader.r.page);
    check(after === before + 1, 'tap on the right turns the page');
    check(await frame(page).evaluate(() => document.scrollingElement.scrollLeft === innerWidth), 'page 2 is aligned to a whole screen');
    await shot(page, 'reader-page2-' + scheme);
    const lastOk = await page.evaluate(() => { const r = window.app.S.reader.r; r.setPage(r.pages - 1); const d = r.doc.scrollingElement; const ok = d.scrollLeft === (r.pages - 1) * innerWidth; r.setPage(1); return ok; });
    check(lastOk, 'the last page scrolls fully into place');
    await tapReader(page, 200, 450);
    check(await page.evaluate(() => window.app.S.reader.chrome), 'tap in the middle shows the controls');
    await shot(page, 'reader-chrome-' + scheme);
    // contents
    await page.click('[data-a="contents"]');
    await page.waitForSelector('.k-sheet .ti');
    await shot(page, 'reader-contents-' + scheme);
    await page.click('.ti[data-i="2"]');
    await page.waitForFunction(() => window.app.S.reader.r.c === 2 && window.app.S.reader.r.ready);
    check(await frame(page).evaluate(() => document.body.textContent.includes('Grey Widow')), 'contents jumps to chapter 3');
    await page.waitForTimeout(300);
    const pos = await page.evaluate(() => window.app.S.reader.pos);
    // Aa: bigger text keeps the same paragraph
    await tapReader(page, 380, 450);
    const p1 = await page.evaluate(() => window.app.S.reader.r.position());
    await tapReader(page, 200, 450);
    await page.click('[data-a="aa"]');
    await page.waitForSelector('.aa');
    await shot(page, 'reader-aa-' + scheme);
    await page.click('[data-a="size"][data-v="1"]');
    await page.click('[data-a="size"][data-v="1"]');
    await page.click('[data-a="size"][data-v="1"]');
    await page.waitForTimeout(300);
    const vis = await page.evaluate((p) => window.app.S.reader.r.isVisible({ s: { p: p.p, o: p.o }, e: { p: p.p, o: p.o + 1 } }), p1);
    check(vis, 'the text that was at the top is still on screen after a font change ' + JSON.stringify(p1));
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.app.back());
    await shot(page, 'reader-bigger-' + scheme);
    // position survives leaving and coming back (like closing the app)
    await page.evaluate(() => { window.app.back(); window.app.flush(); });
    const saved = await page.evaluate((i) => JSON.parse(window.__mock.store['b-' + i]).pos, id);
    check(saved && saved.c === 2, 'position saved ' + JSON.stringify(saved));
    await page.reload();
    await page.waitForFunction(() => window.app && window.app.S.loaded);
    await shot(page, 'library-reading-' + scheme);
    await openBook(page, 'The Keeper of Harwick Light');
    const p3 = await page.evaluate(() => window.app.S.reader.r.position());
    check(p3.c === saved.c && p3.p === saved.p, 'reopens on the saved paragraph ' + JSON.stringify([saved, p3]));
    check(!evil.length, 'no requests outside the app: ' + evil.join(', '));
    check(!errors.length, 'no page errors: ' + errors.join(' | '));
    void pos;
    await ctx.close();
  },

  async 'reader scroll mode'(b, port, scheme) {
    const { page, ctx, errors } = await newPage(b, port, scheme);
    await page.evaluate(() => { const s = window.app.settings(); s.mode = 'scroll'; window.app.touch('settings'); });
    await openBook(page, 'The Keeper of Harwick Light');
    await tapReader(page, 380, 450);
    const y = await frame(page).evaluate(() => window.scrollY);
    check(y > 100, 'tap on the right scrolls down, scrollY=' + y);
    await shot(page, 'reader-scroll-' + scheme);
    check(!errors.length, 'no page errors: ' + errors.join(' | '));
    await ctx.close();
  },

  async 'reader swedish epub2 latin1 sepia'(b, port, scheme) {
    const { page, ctx, errors } = await newPage(b, port, scheme);
    await page.evaluate(() => { const s = window.app.settings(); s.paper = 'sepia'; window.app.touch('settings'); });
    await openBook(page, 'Sommaren på Gråskär');
    check(await frame(page).evaluate(() => document.body.textContent.includes('Gråskär')), 'å ä ö render');
    await shot(page, 'reader-swedish-sepia-' + scheme);
    await page.evaluate(() => window.app.S.reader.r.show(1, null));
    await page.waitForTimeout(400);
    check(await frame(page).evaluate(() => document.body.textContent.includes('främmande')), 'ISO-8859-1 chapter decodes');
    check(await page.evaluate(() => window.app.S.reader.model.lang) === 'sv', 'language sv');
    check(!errors.length, 'no page errors: ' + errors.join(' | '));
    await ctx.close();
  },

  async 'reader images and footnotes'(b, port, scheme) {
    const { page, ctx, errors, evil } = await newPage(b, port, scheme);
    await openBook(page, 'Notes from the Coast');
    const f = frame(page);
    check(await f.evaluate(() => { const i = document.querySelector('img'); return i && i.complete && i.naturalWidth > 0; }), 'image loads');
    check(await f.evaluate(() => getComputedStyle(document.getElementById('n2')).display === 'none'), 'footnote aside is hidden in the text');
    await shot(page, 'reader-images-' + scheme);
    // tap the footnote reference 2 (same chapter)
    const r2 = await f.evaluate(() => { const r = document.getElementById('r2').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await f.click('#r2');
    await page.waitForSelector('.pop', { timeout: 3000 });
    check((await page.textContent('.pop')).includes('harbour office'), 'footnote shown in a popup');
    await shot(page, 'reader-footnote-' + scheme);
    await page.click('[data-a="popClose"]');
    // endnote in another chapter
    await f.click('#r1');
    await page.waitForSelector('.pop');
    check((await page.textContent('.pop')).includes('Thomas Ellery'), 'endnote from the notes chapter');
    await page.click('[data-a="popClose"]');
    // external link: never followed
    await f.click('a.m-ext');
    await page.waitForSelector('.pop');
    check((await page.textContent('.pop')).includes('example.org'), 'external link explained');
    check(!evil.length, 'nothing requested outside the app: ' + evil.join(', '));
    check(!errors.length, 'no page errors: ' + errors.join(' | '));
    void r2;
    await ctx.close();
  },

  async 'reader malicious book stays inert'(b, port, scheme) {
    const { page, ctx, errors, evil } = await newPage(b, port, scheme);
    let messages = 0;
    await page.exposeFunction('__msg', () => { messages++; });
    await page.evaluate(() => window.addEventListener('message', () => window.__msg()));
    await openBook(page, 'Evil Book');
    const f = frame(page);
    await page.waitForTimeout(800);
    check(await f.evaluate(() => document.body.textContent.includes('Plain text that must still be readable')), 'text is readable');
    check((await f.evaluate(() => document.title)) !== 'pwned', 'inline script did not run');
    check(await f.evaluate(() => !document.querySelector('iframe, object, embed, base, meta[http-equiv]')), 'frames, objects, base and meta refresh removed');
    check(await f.evaluate(() => !document.querySelector('a[href]')), 'no link keeps an href');
    // tapping the javascript: link does nothing but explain
    await f.click('text=javascript link');
    await page.waitForTimeout(300);
    check((await page.title()) === 'Margin', 'app page untouched');
    const hover = await f.$('p[onmouseover]');
    if (hover) await hover.hover();
    await page.waitForTimeout(300);
    check(messages === 0, 'book could not post messages');
    check(!evil.length, 'no request ever left the app: ' + evil.join(', '));
    check(!errors.some((e) => /dialog/.test(e)), 'no alert ran: ' + errors.join(' | '));
    check(page.frames().length === 2, 'only the book frame exists, got ' + page.frames().length);
    await shot(page, 'reader-malicious-' + scheme);
    await ctx.close();
  },

  async 'reader text and markdown'(b, port, scheme) {
    const { page, ctx, errors } = await newPage(b, port, scheme);
    await openBook(page, 'plain');
    check(await frame(page).evaluate(() => document.querySelectorAll('p').length > 3), 'text book has paragraphs');
    check(await page.evaluate(() => window.app.S.reader.model.chapters.length) === 2, 'two chapters found in the text book');
    await shot(page, 'reader-text-' + scheme);
    await page.evaluate(() => window.app.back());
    await openBook(page, 'Keeper’s notes');
    check(await frame(page).evaluate(() => !!document.querySelector('strong') && !!document.querySelector('em')), 'markdown formatting');
    check(await page.evaluate(() => window.app.S.reader.model.toc.map((t) => t.label).join('|')) === 'Keeper’s notes|Lamps', 'markdown chapters at ## headings');
    await page.evaluate(() => window.app.S.reader.r.show(1, null));
    await page.waitForTimeout(300);
    const f = frame(page);
    check(await f.evaluate(() => !!document.querySelector('blockquote') && !!document.querySelector('ol li')), 'quotes and lists');
    check(await f.evaluate(() => document.body.textContent.includes('<script>alert(1)</script>')), 'raw HTML shown as text');
    await shot(page, 'reader-markdown-' + scheme);
    check(!errors.length, 'no page errors: ' + errors.join(' | '));
    await ctx.close();
  },

  async 'reader highlight'(b, port, scheme) {
    const { page, ctx, errors } = await newPage(b, port, scheme);
    const id = await openBook(page, 'The Keeper of Harwick Light');
    const f = frame(page);
    // select a phrase programmatically (as a long-press would) and use the toolbar
    await f.evaluate(() => {
      const p = [...document.querySelectorAll('p')].find((x) => x.textContent.includes('harbour smelled'));
      const t = p.firstChild, i = t.data.indexOf('harbour smelled of tar');
      const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 'harbour smelled of tar'.length);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    });
    await page.waitForSelector('.selbar', { timeout: 3000 });
    await shot(page, 'reader-selection-' + scheme);
    await page.click('.selbar [data-v="green"]');
    await page.waitForTimeout(200);
    const saved = await page.evaluate((i) => window.app.bookDoc(i).hl, id);
    check(saved.length === 1 && saved[0].text === 'harbour smelled of tar' && saved[0].color === 'green', 'highlight saved ' + JSON.stringify(saved));
    check(await f.evaluate(() => CSS.highlights.has('mh-green')), 'highlight painted');
    await shot(page, 'reader-highlighted-' + scheme);
    // tap the highlight → toolbar for it; add a note
    const pt = await f.evaluate(() => { const r = CSS.highlights.get('mh-green').values().next().value.getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
    await page.mouse.click(pt[0], pt[1]);
    await page.waitForSelector('.selbar [data-a="hlDelete"]');
    await page.click('[data-a="hlNote"]');
    await page.fill('#mfield', 'Smell of the harbour, first impression.');
    await page.click('[data-a="modalOk"]');
    await page.waitForTimeout(200);
    check(await page.evaluate((i) => window.app.bookDoc(i).hl[0].note, id) === 'Smell of the harbour, first impression.', 'note saved');
    // bookmarks
    await tapReader(page, 200, 450);
    await page.click('[data-a="bookmark"]');
    check(await page.evaluate((i) => window.app.bookDoc(i).bm.length, id) === 1, 'bookmark added');
    await page.click('[data-a="contents"]');
    await page.click('[data-a="ctab"][data-v="hl"]');
    await shot(page, 'reader-highlights-list-' + scheme);
    check(!errors.length, 'no page errors: ' + errors.join(' | '));
    await ctx.close();
  },

  async 'reader search in book'(b, port, scheme) {
    const { page, ctx, errors } = await newPage(b, port, scheme);
    const id = await openBook(page, 'The Keeper of Harwick Light');
    await page.waitForFunction((i) => window.app.bookDoc(i).lens, id, { timeout: 8000 });
    const words = await page.evaluate((i) => window.app.bookDoc(i).words, id);
    check(words > 800, 'words counted: ' + words);
    await tapReader(page, 200, 450);
    await page.click('[data-a="findInBook"]');
    await page.fill('#findq', 'grey widow');
    await page.waitForSelector('.res');
    await shot(page, 'reader-search-' + scheme);
    const n = await page.$$eval('.res', (els) => els.length);
    check(n >= 3, 'search finds the Grey Widow several times, got ' + n);
    await page.click('.res[data-i="2"]');
    await page.waitForTimeout(600);
    const marked = await frame(page).evaluate(() => CSS.highlights.has('mh-find') && [...CSS.highlights.get('mh-find')][0].toString());
    check(/grey widow/i.test(marked || ''), 'the hit is marked: ' + marked);
    const vis = await frame(page).evaluate(() => { const r = [...CSS.highlights.get('mh-find')][0].getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
    check(vis, 'the hit is on screen');
    // exact percentages once the index is built
    const f = await page.evaluate(() => window.app.S.reader.fraction());
    check(f > 0.3 && f < 0.9, 'fraction from the index: ' + f);
    await shot(page, 'reader-search-hit-' + scheme);
    check(!errors.length, 'no page errors: ' + errors.join(' | '));
    await ctx.close();
  },

  async 'settings'(b, port, scheme) {
    const { page, ctx, errors } = await newPage(b, port, scheme);
    await page.click('[data-a="go"][data-to="settings"]');
    await page.waitForTimeout(200);
    await shot(page, 'settings-' + scheme);
    await page.click('[data-a="go"][data-to="folders"]');
    await page.click('[data-a="dirOpen"][data-v$="Documents"]');
    await page.click('[data-a="useFolder"]');
    check(await page.evaluate(() => window.__mock.folders.includes('/storage/emulated/0/Documents')), 'folder added');
    check(!errors.length, 'no page errors: ' + errors.join(' | '));
    await ctx.close();
  },
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { server, port } = await start(0);
  const browser = await pw.chromium.launch();
  for (const [name, fn] of Object.entries(scenarios)) {
    if (only.length && !only.some((o) => name.includes(o))) continue;
    for (const scheme of name === 'logic dom' ? ['light'] : ['light', 'dark']) {
      const label = name + (name === 'logic dom' ? '' : ' (' + scheme + ')');
      try {
        await fn(browser, port, scheme);
        results.push('  ok   ' + label);
      } catch (e) {
        failures++;
        results.push('  FAIL ' + label + '\n       ' + String(e.message || e).split('\n')[0]);
      }
    }
  }
  await browser.close();
  server.close();
  console.log(results.join('\n'));
  console.log(failures ? failures + ' failed' : 'all passed');
  process.exit(failures ? 1 : 0);
})();
