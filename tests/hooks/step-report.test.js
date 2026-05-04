#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const hook = require('../../scripts/hooks/step-report');

module.exports = function(ctx) {
  ctx.assert(typeof hook.run === 'function', 'run exported');

  // Non-calc passes through
  ctx.assert(hook.run(JSON.stringify({ command: 'ls' })) === JSON.stringify({ command: 'ls' }), 'non-calc passes');
  ctx.assert(hook.run('invalid') === 'invalid', 'invalid passes');
  ctx.assert(hook.run('') === '', 'empty passes');

  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-step-report-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'data'), { recursive: true });
  process.chdir(tmpDir);

  try {
    const pipeline = require('../../scripts/lib/pipeline');

    // No plan passes
    const calc = JSON.stringify({ command: 'python -c "x"', exit_code: 0 });
    ctx.assert(hook.run(calc) === calc, 'no plan passes');

    // Create plan with executed step
    const plan = pipeline.createPlan('test', [
      { name: 'clean', input: 'data.csv', method: 'm', output: 'clean.csv' },
      { name: 'desc', input: 'clean.csv', method: 'm', output: 'desc.csv' },
    ]);
    pipeline.updateStepCode(plan, 'step_001', 'calc_001.py');
    const outputFile = path.join(tmpDir, 'output', 'data', 'clean.csv');
    fs.writeFileSync(outputFile, 'a,b\n1,2\n3,4\n', 'utf8');
    pipeline.saveSnapshot(plan, 'step_001', { rows: 2 });

    // Returns input unchanged
    const result = hook.run(calc);
    ctx.assert(result === calc, 'returns input unchanged');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
