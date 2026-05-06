#!/usr/bin/env node
'use strict';

var path = require('path');
var fs = require('fs');
var os = require('os');

var hook = require('../../scripts/hooks/pre-write-structure-check');

module.exports = function(ctx) {
  ctx.assert(typeof hook.run === 'function', 'run exported');
  ctx.assert(typeof hook.isPaperSectionFile === 'function', 'isPaperSectionFile exported');
  ctx.assert(typeof hook.inferSectionType === 'function', 'inferSectionType exported');

  // isPaperSectionFile
  ctx.assert(hook.isPaperSectionFile('output/sections/01-intro.md') === true, 'sections md is paper file');
  ctx.assert(hook.isPaperSectionFile('scripts/test.py') === false, 'py file is not paper file');
  ctx.assert(hook.isPaperSectionFile('output/data/test.csv') === false, 'csv is not paper file');
  ctx.assert(!hook.isPaperSectionFile(''), 'empty is not paper file');

  // inferSectionType
  ctx.assertEqual(hook.inferSectionType('', 'output/sections/01-introduction.md'), 'introduction', 'filename intro');
  ctx.assertEqual(hook.inferSectionType('', 'output/sections/02-literature.md'), 'literature_review', 'filename literature');
  ctx.assertEqual(hook.inferSectionType('', 'output/sections/03-method.md'), 'methodology', 'filename method');
  ctx.assertEqual(hook.inferSectionType('', 'output/sections/04-results.md'), 'results', 'filename results');
  ctx.assertEqual(hook.inferSectionType('# Introduction\nContent', ''), 'introduction', 'content intro');
  ctx.assertEqual(hook.inferSectionType('', 'random.txt'), null, 'unknown returns null');

  // Non-paper file passes through
  var nonPaper = JSON.stringify({ tool_input: { file_path: 'test.py', content: 'print(1)' } });
  ctx.assert(hook.run(nonPaper) === nonPaper, 'non-paper file passes through');

  // No schema passes through
  var origCwd = process.cwd();
  var tmpDir = path.join(os.tmpdir(), 'everypaper-struct-test-' + Date.now());
  var defaultsDir = path.join(tmpDir, 'defaults');
  fs.mkdirSync(path.join(tmpDir, 'output', 'sections'), { recursive: true });
  fs.mkdirSync(defaultsDir, { recursive: true });

  // Create defaults file so checkSectionStructure works
  fs.writeFileSync(path.join(defaultsDir, 'format-defaults.json'), JSON.stringify({
    required_sections: ['introduction', 'literature_review', 'methodology', 'results', 'conclusion'],
    section_order: ['introduction', 'literature_review', 'methodology', 'results', 'conclusion']
  }), 'utf8');

  process.chdir(tmpDir);
  try {
    var paperInput = JSON.stringify({ tool_input: { file_path: 'output/sections/01-intro.md', content: '# Introduction' } });
    ctx.assert(hook.run(paperInput) === paperInput, 'no schema passes through');

    // With schema and missing sections
    fs.writeFileSync(path.join(tmpDir, 'output', 'paper-schema.json'), JSON.stringify({
      version: 1, sections: [
        { id: 's1', type: 'introduction' },
        { id: 's2', type: 'results' }
      ], tables: [], figures: []
    }), 'utf8');

    var result = hook.run(paperInput);
    ctx.assert(typeof result === 'object', 'missing sections returns object');
    ctx.assertEqual(result.exitCode, 2, 'missing sections blocks with exitCode 2');
    ctx.assert(result.stderr.indexOf('必需章节') !== -1, 'stderr mentions required sections');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
