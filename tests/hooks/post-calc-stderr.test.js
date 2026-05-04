#!/usr/bin/env node
'use strict';

const hook = require('../../scripts/hooks/post-calc-stderr');

module.exports = function(ctx) {
  ctx.assert(typeof hook.run === 'function', 'run exported');
  ctx.assert(typeof hook.analyzeStderr === 'function', 'analyzeStderr exported');
  ctx.assert(typeof hook.deduplicateIssues === 'function', 'deduplicateIssues exported');

  const nonCalc = JSON.stringify({ command: 'ls -la' });
  ctx.assert(hook.run(nonCalc) === nonCalc, 'non-calc passes');

  ctx.assert(hook.run('invalid') === 'invalid', 'invalid passes');
  ctx.assert(hook.run('') === '', 'empty passes');

  const calc = JSON.stringify({ command: 'python -c "x"', result: { stderr: '' } });
  ctx.assert(hook.run(calc) === calc, 'no stderr passes');

  const empty = hook.analyzeStderr('');
  ctx.assertEqual(empty.length, 0, 'empty stderr no issues');

  const normal = hook.analyzeStderr('some normal output');
  ctx.assertEqual(normal.length, 0, 'normal output no issues');

  const importErr = hook.analyzeStderr('ModuleNotFoundError: No module named pandas');
  ctx.assert(importErr.length > 0, 'import error detected');
  ctx.assertEqual(importErr[0].level, 'critical', 'import is critical');
  ctx.assertEqual(importErr[0].category, 'import', 'category is import');

  const settingWarn = hook.analyzeStderr('SettingWithCopyWarning: A value is trying to be set');
  ctx.assert(settingWarn.length > 0, 'setting warning detected');
  ctx.assertEqual(settingWarn[0].level, 'critical', 'setting is critical');

  const futureWarn = hook.analyzeStderr('FutureWarning: some future change');
  ctx.assert(futureWarn.length > 0, 'future warning detected');
  ctx.assertEqual(futureWarn[0].level, 'info', 'future is info');

  const memErr = hook.analyzeStderr('MemoryError: unable to allocate');
  ctx.assert(memErr.length > 0, 'memory error detected');
  ctx.assertEqual(memErr[0].level, 'critical', 'memory is critical');

  const issues = [
    { level: 'warning', category: 'pandas', message: 'msg1' },
    { level: 'warning', category: 'pandas', message: 'msg1' },
    { level: 'critical', category: 'import', message: 'msg2' },
  ];
  const deduped = hook.deduplicateIssues(issues);
  ctx.assertEqual(deduped.length, 2, 'deduplicates by category:message');

  // SettingWithCopyWarning blocks execution
  const settingInput = JSON.stringify({
    command: 'python -c "x"',
    result: { stderr: 'SettingWithCopyWarning: A value is trying to be set on a copy' },
  });
  const settingResult = hook.run(settingInput);
  ctx.assert(typeof settingResult === 'object', 'setting warning returns object');
  ctx.assertEqual(settingResult.exitCode, 2, 'setting warning blocks with exitCode 2');
  ctx.assert(settingResult.stderr.includes('SettingWithCopyWarning'), 'stderr mentions warning');

  // DtypeWarning blocks execution
  const dtypeInput = JSON.stringify({
    command: 'python -c "x"',
    result: { stderr: 'DtypeWarning: Columns have mixed types' },
  });
  const dtypeResult = hook.run(dtypeInput);
  ctx.assert(typeof dtypeResult === 'object', 'dtype warning returns object');
  ctx.assertEqual(dtypeResult.exitCode, 2, 'dtype warning blocks with exitCode 2');

  // Normal warning still passes through
  const normalWarnInput = JSON.stringify({
    command: 'python -c "x"',
    result: { stderr: 'FutureWarning: some future change' },
  });
  const normalResult = hook.run(normalWarnInput);
  ctx.assert(typeof normalResult === 'string', 'non-critical warning passes');
};
