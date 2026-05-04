#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const hook = require('../../scripts/hooks/pre-pipeline-check');

module.exports = function(ctx) {
  // Exports
  ctx.assert(typeof hook.run === 'function', 'run exported');

  // Non-calc command passes through unchanged
  const nonCalc = JSON.stringify({ command: 'ls -la', tool_input: { command: 'ls -la' } });
  const passResult = hook.run(nonCalc);
  ctx.assert(passResult === nonCalc, 'non-calc command passes through');

  // Invalid JSON passes through
  ctx.assert(hook.run('invalid') === 'invalid', 'invalid JSON passes through');
  ctx.assert(hook.run('') === '', 'empty input passes through');

  // Temp directory setup
  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-pipeline-check-test-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'data'), { recursive: true });
  process.chdir(tmpDir);

  try {
    // Calc command without plan.json passes through
    const calcNoPlan = JSON.stringify({
      command: 'python -c "print(1)"',
      tool_input: { command: 'python -c "print(1)"' },
    });
    const noPlanResult = hook.run(calcNoPlan);
    ctx.assert(noPlanResult === calcNoPlan, 'calc without plan passes through');

    // Create a plan with no stale steps
    const pipeline = require('../../scripts/lib/pipeline');
    pipeline.createPlan('测试研究', [
      { name: '步骤1', input: 'data.csv', method: '清洗', output: 'clean.csv' },
    ]);
    pipeline.updateStepCode(pipeline.loadPlan(), 'step_001', 'calc_001.py');
    pipeline.savePlan(pipeline.loadPlan());

    const calcWithPlan = JSON.stringify({
      command: 'python -c "print(2)"',
      tool_input: { command: 'python -c "print(2)"' },
    });
    const cleanResult = hook.run(calcWithPlan);
    ctx.assert(cleanResult === calcWithPlan, 'calc with clean plan passes through');

    // Mark step stale, calc command should be blocked (returns object with exitCode 2)
    const plan = pipeline.loadPlan();
    pipeline.markStale(plan, 'step_001', '源数据已变更');

    const staleResult = hook.run(calcWithPlan);
    ctx.assert(typeof staleResult === 'object', 'calc with stale plan returns object');
    ctx.assertEqual(staleResult.exitCode, 2, 'stale plan blocks with exitCode 2');
    ctx.assert(staleResult.stderr.includes('过期步骤'), 'stale plan stderr mentions stale steps');

    // R command also triggers check and blocks
    const rInput = JSON.stringify({
      command: 'Rscript -e "cat(42)"',
      tool_input: { command: 'Rscript -e "cat(42)"' },
    });
    const rResult = hook.run(rInput);
    ctx.assert(typeof rResult === 'object', 'R command with stale plan returns object');
    ctx.assertEqual(rResult.exitCode, 2, 'R stale plan blocks with exitCode 2');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
