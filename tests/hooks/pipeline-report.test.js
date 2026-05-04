#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const hook = require('../../scripts/hooks/pipeline-report');

module.exports = function(ctx) {
  ctx.assert(typeof hook.run === 'function', 'run exported');

  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-pipeline-report-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'data'), { recursive: true });
  process.chdir(tmpDir);

  try {
    // No plan passes
    ctx.assert(hook.run('{}') === '{}', 'no plan passes');
    ctx.assert(hook.run('invalid') === 'invalid', 'invalid passes');
    ctx.assert(hook.run('') === '', 'empty passes');

    // Create plan
    const pipeline = require('../../scripts/lib/pipeline');
    const plan = pipeline.createPlan('test research', [
      { name: 'clean', input: 'data.xlsx', method: 'm', output: 'clean.csv' },
    ]);
    pipeline.registerSource(plan, 'data.xlsx', '原始数据');
    pipeline.updateStepCode(plan, 'step_001', 'calc_001.py');
    const outputFile = path.join(tmpDir, 'output', 'data', 'clean.csv');
    fs.writeFileSync(outputFile, 'a,b\n1,2\n', 'utf8');
    pipeline.saveSnapshot(plan, 'step_001', { rows: 1 });

    // Returns input unchanged, generates flow diagram
    const result = hook.run('{}');
    ctx.assert(result === '{}', 'returns input unchanged');

    const diagramFile = path.join(tmpDir, 'output', 'data', 'flow-diagram.md');
    ctx.assert(fs.existsSync(diagramFile), 'flow-diagram.md generated');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
