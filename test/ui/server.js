/* Desktop stand-in for MainActivity: serves the bundled UI and the same routes the app serves
   (/book/ID/PATH, /cover/ID, /raw/ID, /fonts/…) with the same Content-Security-Policies, over the
   test books in app/src/test/resources/books. Library entries and EPUB structures come from the
   real Java classes (Library, Epub) through the Dump helper, so the browser sees what the phone sees.

   node test/ui/server.js [port]   — then open http://localhost:PORT/?mock=1 in Chromium. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const WWW = path.join(ROOT, 'app/src/main/assets/www');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const BOOKS = path.join(ROOT, 'app/src/test/resources/books');

const PAGE_CSP = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-src 'self'; child-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
const KIT_CSP = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'";
const BOOK_CSP = "default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; media-src 'self'; script-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'";

// ---------------------------------------------------------------- library from the Java classes
function dump() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'margin-dump-'));
  const src = ['Epub', 'Library'].map((n) => path.join(ROOT, 'app/src/main/java/io/github/rushivangala/margin', n + '.java'));
  src.push(path.join(ROOT, 'app/src/test/java/io/github/rushivangala/margin/Dump.java'));
  execFileSync('javac', ['-nowarn', '--release', '17', '-d', out].concat(src), { stdio: 'pipe' });
  const json = execFileSync('java', ['-cp', out, 'io.github.rushivangala.margin.Dump', BOOKS], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(json.trim().split('\n').pop());
}

// ---------------------------------------------------------------- a small ZIP reader
function readZip(file) {
  const b = fs.readFileSync(file);
  let eocd = b.length - 22;
  while (eocd >= 0 && b.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  const entries = {};
  for (let i = 0; i < count; i++) {
    const method = b.readUInt16LE(p + 10), csize = b.readUInt32LE(p + 20), nlen = b.readUInt16LE(p + 28), xlen = b.readUInt16LE(p + 30), clen = b.readUInt16LE(p + 32), off = b.readUInt32LE(p + 42);
    const name = b.slice(p + 46, p + 46 + nlen).toString('utf8');
    entries[name] = { method, csize, off };
    p += 46 + nlen + xlen + clen;
  }
  return {
    get(name) {
      const e = entries[name];
      if (!e) return null;
      const lnlen = b.readUInt16LE(e.off + 26), lxlen = b.readUInt16LE(e.off + 28);
      const data = b.slice(e.off + 30 + lnlen + lxlen, e.off + 30 + lnlen + lxlen + e.csize);
      return e.method === 8 ? zlib.inflateRawSync(data) : data;
    },
  };
}

const ENT = { nbsp: 160, mdash: 8212, ndash: 8211, hellip: 8230, rsquo: 8217, lsquo: 8216, ldquo: 8220, rdquo: 8221, copy: 169 };
function htmlEntities(s) { return s.replace(/&([A-Za-z][A-Za-z0-9]*);/g, (m, n) => (/^(amp|lt|gt|quot|apos)$/.test(n) ? m : '&#' + (ENT[n] || 32) + ';')); }
function decode(buf) {
  const head = buf.slice(0, 200).toString('latin1');
  const m = /encoding=["']([A-Za-z0-9_-]+)["']/.exec(head);
  if (m && /^iso-8859-1|latin1|windows-1252$/i.test(m[1])) return buf.toString('latin1').replace(/encoding=["'][A-Za-z0-9_-]+["']/, 'encoding="UTF-8"');
  return buf.toString('utf8').replace(/^﻿/, '');
}
function sanitize(s) { return s.replace(/<meta[^>]+http-equiv\s*=\s*["']?refresh[^>]*>/gi, '').replace(/<base\b[^>]*>/gi, ''); }
function type(p) {
  const x = p.toLowerCase();
  if (/\.x?html?$/.test(x)) return /\.xhtml$/.test(x) || /\.html$/.test(x) ? 'application/xhtml+xml' : 'text/html';
  return { css: 'text/css', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', woff2: 'font/woff2', js: 'application/javascript', json: 'application/json', txt: 'text/plain' }[x.split('.').pop()] || 'application/octet-stream';
}

function start(port) {
  const data = dump();
  const byId = {};
  data.books.forEach((b) => { byId[b.id] = b; });
  const zips = {};
  const zipOf = (id) => zips[id] || (zips[id] = readZip(byId[id].path));
  const requests = [];

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p = decodeURIComponent(u.pathname);
    requests.push(p);
    const send = (code, mime, body, csp) => {
      res.writeHead(code, { 'Content-Type': mime + (/^(text|application\/(xhtml|javascript|json))/.test(mime) ? '; charset=utf-8' : ''), 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
      res.end(body);
    };
    try {
      if (p === '/' || p === '/index.html') return send(200, 'text/html', fs.readFileSync(path.join(WWW, 'index.html')), PAGE_CSP);
      if (p === '/__data') return send(200, 'application/json', JSON.stringify(data), KIT_CSP);
      if (p === '/__requests') return send(200, 'application/json', JSON.stringify(requests.splice(0)), KIT_CSP);
      if (p.startsWith('/book/')) {
        const rest = p.slice(6), slash = rest.indexOf('/'), id = rest.slice(0, slash), entry = rest.slice(slash + 1);
        const b = byId[id];
        if (!b) return send(404, 'text/plain', '', BOOK_CSP);
        if (b.format === 'html') return send(200, 'text/html', sanitize(fs.readFileSync(b.path, 'utf8')), BOOK_CSP);
        const raw = zipOf(id).get(entry);
        if (!raw) return send(404, 'text/plain', '', BOOK_CSP);
        const st = data.structures[id] || {};
        let t = type(entry);
        const asHtml = u.searchParams.get('html') === '1';
        if (/html|xml/.test(t) && !/svg/.test(t)) {
          let s = sanitize(decode(raw));
          if (!asHtml) s = htmlEntities(s);
          return send(200, asHtml ? 'text/html' : 'application/xhtml+xml', s, BOOK_CSP);
        }
        void st;
        if (/^(text\/css|image\/|font\/)/.test(t)) return send(200, t, raw, BOOK_CSP);
        return send(404, 'text/plain', '', BOOK_CSP);
      }
      if (p.startsWith('/cover/')) {
        const id = p.slice(7), b = byId[id];
        if (!b || b.format !== 'epub' || !b.meta.cover || /\.svg$/i.test(b.meta.cover)) return send(404, 'text/plain', '', BOOK_CSP);
        return send(200, type(b.meta.cover), zipOf(id).get(b.meta.cover), BOOK_CSP);
      }
      if (p.startsWith('/raw/')) {
        const b = byId[p.slice(5)];
        if (!b || !/^(txt|md)$/.test(b.format)) return send(404, 'text/plain', '', BOOK_CSP);
        return send(200, 'text/plain', fs.readFileSync(b.path, 'utf8'), BOOK_CSP);
      }
      if (p.startsWith('/pdf/')) return send(404, 'text/plain', '', BOOK_CSP);
      if (p.startsWith('/fonts/') && /^[a-z0-9-]+\.woff2$/.test(p.slice(7))) return send(200, 'font/woff2', fs.readFileSync(path.join(ASSETS, 'fonts', p.slice(7))), KIT_CSP);
      if (p.startsWith('/test/')) return send(200, type(p), fs.readFileSync(path.join(__dirname, p.slice(6))), KIT_CSP);
      const f = path.join(WWW, p);
      if (!f.startsWith(WWW) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return send(404, 'text/plain', '', KIT_CSP);
      return send(200, type(f), fs.readFileSync(f), KIT_CSP);
    } catch (e) {
      return send(500, 'text/plain', String(e), KIT_CSP);
    }
  });
  return new Promise((resolve) => server.listen(port || 0, '127.0.0.1', () => resolve({ server, port: server.address().port, data })));
}

module.exports = { start };
if (require.main === module) start(+process.argv[2] || 8777).then((s) => console.log('Margin test server on http://localhost:' + s.port + '/'));
