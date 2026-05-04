#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const hook = require('../../scripts/hooks/cross-step-consistency');

module.exports = function(ctx) {
  ctx.assert(typeof hook.run === 'function', 'run exported');

  const nonCalc = JSON.stringify({ command: 'ls -la', tool_input: { command: 'ls -la' } });
  ctx.assert(hook.run(nonCalc) === nonCalc, 'non-calc passes');

  ctx.assert(hook.run('invalid') === 'invalid', 'invalid passes');
  ctx.assert(hook.run('') === '', 'empty passes');

  const failed = JSON.stringify({ command: 'python -c "x"', exit_code: 1 });
  ctx.assert(hook.run(failed) === failed, 'failed command passes');

  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-consistency-test-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'data'), { recursive: true });
  process.chdir(tmpDir);

  try {
    const calc = JSON.stringify({ command: 'python -c "x"', exit_code: 0 });
    ctx.assert(hook.run(calc) === calc, 'no plan passes');

    const pipeline = require('../../scripts/lib/pipeline');
    const plan = pipeline.createPlan('test', [
      { name: 'clean', input: 'data.csv', method: 'm', output: 'clean.csv' },
      { name: 'analyze', input: 'clean.csv', method: 'm', output: 'result.csv' },
    ]);

    const cleanFile = path.join(tmpDir, 'output', 'data', 'clean.csv');
    fs.writeFileSync(cleanFile, 'firm_id,year,audit_fee\n1,2023,100\n', 'utf8');

    pipeline.updateStepCode(plan, 'step_001', 'calc_001.py');
    pipeline.saveSnapshot(plan, 'step_001', { rows: 1 });

    ctx.assert(hook.run(calc) === calc, 'clean plan passes');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
