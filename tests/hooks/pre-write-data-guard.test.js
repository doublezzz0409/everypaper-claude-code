#!/usr/bin/env node
'use strict';

const hook = require('../../scripts/hooks/pre-write-data-guard');

module.exports = function(ctx) {
  ctx.assert(typeof hook.run === 'function', 'run exported');
  ctx.assert(typeof hook.validateCsvContent === 'function', 'validateCsvContent exported');

  const nonData = JSON.stringify({ tool_input: { file_path: '/tmp/readme.md', content: 'hello' } });
  ctx.assert(hook.run(nonData) === nonData, 'non-data file passes');

  ctx.assert(hook.run('{}') === '{}', 'no file_path passes');
  ctx.assert(hook.run('invalid') === 'invalid', 'invalid JSON passes');
  ctx.assert(hook.run('') === '', 'empty passes');

  const validCsv = JSON.stringify({ tool_input: { file_path: '/tmp/data.csv', content: 'a,b\n1,2\n3,4\n' } });
  ctx.assert(hook.run(validCsv) === validCsv, 'valid CSV passes');

  const emptyCsv = JSON.stringify({ tool_input: { file_path: '/tmp/empty.csv', content: '' } });
  const emptyResult = hook.run(emptyCsv);
  ctx.assert(typeof emptyResult === 'object', 'empty CSV returns object');
  ctx.assertEqual(emptyResult.exitCode, 2, 'empty CSV blocks');

  const badCsv = JSON.stringify({ tool_input: { file_path: '/tmp/bad.csv', content: 'a,b\n1,2,3\n4,5\n' } });
  const badResult = hook.run(badCsv);
  ctx.assert(typeof badResult === 'object', 'bad CSV returns object');
  ctx.assertEqual(badResult.exitCode, 2, 'bad CSV blocks');

  const v1 = hook.validateCsvContent('a,b\n1,2\n');
  ctx.assert(v1.ok === true, 'valid content ok');

  const v2 = hook.validateCsvContent('');
  ctx.assert(v2.ok === false, 'empty content not ok');

  const v3 = hook.validateCsvContent('a b,c\n1,2\n');
  const warnings = v3.issues.filter(i => i.level === 'warning');
  ctx.assert(warnings.length > 0, 'space in col name warns');
};
