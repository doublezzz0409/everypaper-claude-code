#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const hook = require('../../scripts/hooks/post-calc-output-verify');

module.exports = function(ctx) {
  ctx.assert(typeof hook.run === 'function', 'run exported');

  // Non-calc passes through
  const nonCalc = JSON.stringify({ command: 'ls -la' });
  ctx.assert(hook.run(nonCalc) === nonCalc, 'non-calc passes through');
  ctx.assert(hook.run('invalid') === 'invalid', 'invalid JSON passes');
  ctx.assert(hook.run('') === '', 'empty passes');

  // Failed command passes through
  const failed = JSON.stringify({ command: 'python -c "x"', exit_code: 1 });
  ctx.assert(hook.run(failed) === failed, 'failed command passes');

  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-output-verify-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'data'), { recursive: true });
  process.chdir(tmpDir);

  try {
    const pipeline = require('../../scripts/lib/pipeline');

    // No plan passes through
    const calc = JSON.stringify({ command: 'python -c "print(1)"', exit_code: 0 });
    ctx.assert(hook.run(calc) === calc, 'no plan passes');

    // Create plan with output file
    const plan = pipeline.createPlan('test', [
      { name: 'clean', input: 'data.csv', method: 'clean', output: 'clean.csv' },
    ]);
    pipeline.updateStepCode(plan, 'step_001', 'calc_001.py');
    const outputFile = path.join(tmpDir, 'output', 'data', 'clean.csv');
    fs.writeFileSync(outputFile, 'a,b\n1,2\n', 'utf8');
    pipeline.saveSnapshot(plan, 'step_001', { rows: 1 });

    // Valid output passes through
    ctx.assert(hook.run(calc) === calc, 'valid output passes');

    // Missing output blocks
    const plan2 = pipeline.createPlan('test2', [
      { name: 's1', input: 'x.csv', method: 'm', output: 'missing.csv' },
    ]);
    pipeline.updateStepCode(plan2, 'step_001', 'calc_001.py');
    pipeline.savePlan(plan2);

    const blocked = hook.run(calc);
    ctx.assert(typeof blocked === 'object', 'blocked returns object');
    ctx.assertEqual(blocked.exitCode, 2, 'blocked exit code 2');
    ctx.assert(blocked.stderr.includes('不存在'), 'blocked message');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
