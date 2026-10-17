/* Runs the JavaScript unit tests (test/*.test.js) with plain node — no packages needed.
   The Gradle release build runs this too, when node is installed. */
'use strict';
const fs = require('fs');
const path = require('path');
let failed = 0, passed = 0;
for (const f of fs.readdirSync(__dirname).filter((n) => n.endsWith('.test.js')).sort()) {
  const tests = require(path.join(__dirname, f));
  for (const [name, fn] of Object.entries(tests)) {
    try { fn(); passed++; } catch (e) { failed++; console.log('FAIL ' + f + ' › ' + name + '\n     ' + (e && e.stack || e).split('\n').slice(0, 3).join('\n     ')); }
  }
}
console.log(passed + ' passed' + (failed ? ', ' + failed + ' failed' : ''));
process.exit(failed ? 1 : 0);
