#!/usr/bin/env node
'use strict';

var path = require('path');
var fs = require('fs');
var os = require('os');

var hook = require('../../scripts/hooks/post-figure-verify');

module.exports = function(ctx) {
  ctx.assert(typeof hook.run === 'function', 'run exported');

  var nonFig = JSON.stringify({ command: 'ls -la', exit_code: 0 });
  ctx.assert(hook.run(nonFig) === nonFig, 'non-figure command passes through');

  var failed = JSON.stringify({ command: 'plt.savefig("test.png")', exit_code: 1 });
  ctx.assert(hook.run(failed) === failed, 'failed command passes through');

  var origCwd = process.cwd();
  var tmpDir = path.join(os.tmpdir(), 'everypaper-figtest-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'figures'), { recursive: true });
  process.chdir(tmpDir);

  try {
    var noPath = JSON.stringify({ command: 'plt.show()', exit_code: 0 });
    ctx.assert(hook.run(noPath) === noPath, 'no output path passes through');

    var missingPath = path.join(tmpDir, 'output', 'figures', 'missing.png');
    var missing = JSON.stringify({ command: 'plt.savefig("' + missingPath + '")', exit_code: 0 });
    var r1 = hook.run(missing);
    ctx.assert(typeof r1 === 'object', 'missing file returns object');
    ctx.assertEqual(r1.exitCode, 2, 'missing file blocks');

    var figPath = path.join(tmpDir, 'output', 'figures', 'test.png');
    fs.writeFileSync(figPath, Buffer.alloc(2048));
    var existing = JSON.stringify({ command: 'plt.savefig("' + figPath + '")', exit_code: 0 });
    var r2 = hook.run(existing);
    ctx.assert(r2 === existing, 'existing file passes through');

    var tinyPath = path.join(tmpDir, 'output', 'figures', 'tiny.png');
    fs.writeFileSync(tinyPath, Buffer.alloc(100));
    var tiny = JSON.stringify({ command: 'plt.savefig("' + tinyPath + '")', exit_code: 0 });
    var r3 = hook.run(tiny);
    ctx.assert(typeof r3 === 'object', 'tiny file returns object');
    ctx.assertEqual(r3.exitCode, 2, 'tiny file blocks');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
