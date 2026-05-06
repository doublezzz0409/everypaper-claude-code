#!/usr/bin/env node
'use strict';

var hook = require('../../scripts/hooks/post-write-numbering-check');

module.exports = function(ctx) {
  ctx.assert(typeof hook.run === 'function', 'run exported');

  // Non-paper file passes through
  var nonPaper = JSON.stringify({ tool_input: { file_path: 'test.py', content: 'x=1' } });
  ctx.assert(hook.run(nonPaper) === nonPaper, 'non-paper passes through');

  // Empty content passes through
  var empty = JSON.stringify({ tool_input: { file_path: 'output/sections/01.md', content: '' } });
  ctx.assert(hook.run(empty) === empty, 'empty passes through');

  // Continuous numbering passes through (never blocks)
  var continuous = JSON.stringify({ tool_input: { file_path: 'output/sections/01.md', content: 'Table 1, Table 2, Figure 1.' } });
  ctx.assert(hook.run(continuous) === continuous, 'continuous passes through');

  // Gap numbering also passes through (warning only, never blocks)
  var gap = JSON.stringify({ tool_input: { file_path: 'output/sections/01.md', content: 'Table 1, Table 3.' } });
  ctx.assert(hook.run(gap) === gap, 'gap passes through (warning only)');
};
