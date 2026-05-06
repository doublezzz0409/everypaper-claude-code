#!/usr/bin/env node
'use strict';

var hook = require('../../scripts/hooks/pre-write-citation-format');

module.exports = function(ctx) {
  ctx.assert(typeof hook.run === 'function', 'run exported');

  // Non-paper file passes through
  var nonPaper = JSON.stringify({ tool_input: { file_path: 'test.py', content: 'x=1' } });
  ctx.assert(hook.run(nonPaper) === nonPaper, 'non-paper passes through');

  // Empty content passes through
  var empty = JSON.stringify({ tool_input: { file_path: 'output/sections/01.md', content: '' } });
  ctx.assert(hook.run(empty) === empty, 'empty content passes through');

  // Consistent APA passes through
  var origCwd = process.cwd();
  var tmpDir = require('path').join(require('os').tmpdir(), 'everypaper-cite-test-' + Date.now());
  require('fs').mkdirSync(require('path').join(tmpDir, 'output'), { recursive: true });
  process.chdir(tmpDir);
  try {
    // No schema, no error
    var input1 = JSON.stringify({ tool_input: { file_path: 'output/sections/01.md', content: 'As shown by (Zhang, 2023).' } });
    ctx.assert(hook.run(input1) === input1, 'no schema passes through');
  } finally {
    process.chdir(origCwd);
    require('fs').rmSync(tmpDir, { recursive: true, force: true });
  }
};
