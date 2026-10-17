/* A stand-in for window.Native (Bridge.java) in a desktop browser, for the UI tests.
   Injected before the app's scripts; data comes from the test server (/__data). */
(function () {
  'use strict';
  if (window.top !== window) return; // init scripts also run in the book's frame; the mock is for the app page only
  var x = new XMLHttpRequest();
  x.open('GET', '/__data', false);
  x.send();
  var data = JSON.parse(x.responseText);
  var store = {};
  try { store = JSON.parse(sessionStorage.getItem('mock-store') || '{}'); } catch (e) { store = {}; }
  function persist() { try { sessionStorage.setItem('mock-store', JSON.stringify(store)); } catch (e) {} }
  var M = window.__mock = { data: data, store: store, launch: '', reading: null, calls: [], folders: ['/storage/emulated/0/Books', '/storage/emulated/0/Download'], allFiles: true, sent: [] };
  function reply(ev) { setTimeout(function () { if (window.app) window.app.onNative(ev); }, 5); }
  window.Native = {
    version: function () { return '1.0.0-test'; },
    status: function () { return JSON.stringify({ version: '1.0.0-test', allFiles: M.allFiles, noInternet: true, sdk: 36, pdfText: true, folders: M.folders, root: '/storage/emulated/0' }); },
    takeLaunch: function () { var l = M.launch; M.launch = ''; return l; },
    library: function (token) { reply({ type: 'library', token: token, ok: true, books: M.allFiles ? data.books : [] }); },
    structure: function (id) { return JSON.stringify(data.structures[id] || {}); },
    pdfInfo: function () { return JSON.stringify({ pages: 2, sizes: [[420, 595], [420, 595]], text: true }); },
    pdfText: function (id, token) { reply({ type: 'pdfText', token: token, ok: true, text: { pages: [[{ t: 'Notes on the Harwick Chart\nThe surveyor came ashore at Harwick in the spring of 1851 and spent the sum-\nmer measuring the bay.', b: [40, 40, 380, 120] }], [{ t: 'Column one. The fishermen\ncame to watch.', b: [40, 40, 190, 300] }, { t: 'Column two. He drew the\nchart by lamplight.', b: [220, 40, 380, 300] }]] } }); },
    load: function (k) { return store[k] || ''; },
    save: function (k, v) { store[k] = v; persist(); return true; },
    remove: function (k) { delete store[k]; persist(); return true; },
    keys: function (p) { return JSON.stringify(Object.keys(store).filter(function (k) { return k.indexOf(p) === 0; }).sort()); },
    setReading: function (on, vol) { M.reading = { on: on, vol: vol }; },
    setFolders: function (j) { M.folders = JSON.parse(j); },
    listDirs: function (p) { p = p || '/storage/emulated/0'; return JSON.stringify({ path: p, parent: p === '/storage/emulated/0' ? '' : p.slice(0, p.lastIndexOf('/')), dirs: p === '/storage/emulated/0' ? ['Books', 'Documents', 'Download', 'Music'] : [] }); },
    importBooks: function (token) { reply({ type: 'import', token: token, ok: false }); },
    requestAllFiles: function () { M.calls.push('requestAllFiles'); },
    forgetCover: function () {},
    hasDaybook: function () { return M.daybook !== false; },
    toDaybook: function (title, text, key, token) { M.sent.push({ title: title, text: text, key: key }); reply({ type: 'daybook', token: token, ok: M.daybook !== false }); },
    shareText: function (s, t) { M.shared = { subject: s, text: t }; },
    saveText: function (name, mime, text, token) { M.saved = { name: name, mime: mime, text: text }; reply({ type: 'save', token: token, ok: true }); },
  };
  window.KitNative = undefined;
})();
