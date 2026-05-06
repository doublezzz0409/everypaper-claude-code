#!/usr/bin/env node
'use strict';

var path = require('path');
var fs = require('fs');
var os = require('os');

var hook = require('../../scripts/hooks/post-write-xref-check');

module.exports = function(ctx) {
  ctx.assert(typeof hook.run === 'function', 'run exported');

  // Non-paper file passes through
  var nonPaper = JSON.stringify({ tool_input: { file_path: 'test.py', content: 'x=1' } });
  ctx.assert(hook.run(nonPaper) === nonPaper, 'non-paper passes through');

  var origCwd = process.cwd();
  var tmpDir = path.join(os.tmpdir(), 'everypaper-xref-test-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output'), { recursive: true });
  process.chdir(tmpDir);

  try {
    // No schema passes through
    var input1 = JSON.stringify({ tool_input: { file_path: 'output/sections/01.md', content: 'See Table 1.' } });
    ctx.assert(hook.run(input1) === input1, 'no schema passes through');

    // With schema — ref exists
    fs.writeFileSync(path.join(tmpDir, 'output', 'paper-schema.json'), JSON.stringify({
      version: 1, sections: [], tables: [{ number: 1, id: 't1' }], figures: []
    }), 'utf8');

    var input2 = JSON.stringify({ tool_input: { file_path: 'output/sections/01.md', content: 'See Table 1.' } });
    ctx.assert(hook.run(input2) === input2, 'existing ref passes through');

    // With schema — ref missing
    var input3 = JSON.stringify({ tool_input: { file_path: 'output/sections/01.md', content: 'See Table 5.' } });
    var result = hook.run(input3);
    ctx.assert(typeof result === 'object', 'missing ref returns object');
    ctx.assertEqual(result.exitCode, 2, 'missing ref blocks');
    ctx.assert(result.stderr.indexOf('Table 5') !== -1, 'stderr mentions Table 5');

    // Empty content passes through
    var input4 = JSON.stringify({ tool_input: { file_path: 'output/sections/01.md', content: '' } });
    ctx.assert(hook.run(input4) === input4, 'empty content passes');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
