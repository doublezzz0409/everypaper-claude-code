#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const hook = require('../../scripts/hooks/pre-calc-quality');

module.exports = function(ctx) {
  ctx.assert(typeof hook.run === 'function', 'run exported');

  const nonCalc = JSON.stringify({ command: 'ls -la', tool_input: { command: 'ls -la' } });
  ctx.assert(hook.run(nonCalc) === nonCalc, 'non-calc passes');

  ctx.assert(hook.run('invalid') === 'invalid', 'invalid passes');
  ctx.assert(hook.run('') === '', 'empty passes');

  const failed = JSON.stringify({ command: 'python -c "x"', exit_code: 1 });
  ctx.assert(hook.run(failed) === failed, 'failed command passes');

  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-quality-test-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'data'), { recursive: true });
  process.chdir(tmpDir);

  try {
    const noRef = JSON.stringify({ command: 'python -c "print(1)"', exit_code: 0 });
    ctx.assert(hook.run(noRef) === noRef, 'no data refs passes');

    const dataFile = path.join(tmpDir, 'test.csv');
    fs.writeFileSync(dataFile, 'firm_id,year,audit_fee\n1,2023,100\n2,2024,200\n', 'utf8');
    const withData = JSON.stringify({
      command: 'python -c "import pandas as pd; pd.read_csv(\'test.csv\')"',
      exit_code: 0,
    });
    const r1 = hook.run(withData);
    ctx.assert(r1 === withData, 'good data passes');

    const emptyFile = path.join(tmpDir, 'empty.csv');
    fs.writeFileSync(emptyFile, '', 'utf8');
    const withEmpty = JSON.stringify({
      command: 'python -c "import pandas as pd; pd.read_csv(\'empty.csv\')"',
      exit_code: 0,
    });
    const r2 = hook.run(withEmpty);
    ctx.assert(typeof r2 === 'object', 'empty data returns object');
    ctx.assertEqual(r2.exitCode, 2, 'empty data blocks');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
