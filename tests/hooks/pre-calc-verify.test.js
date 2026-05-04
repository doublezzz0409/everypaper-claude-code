#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const verifyHook = require('../../scripts/hooks/pre-calc-verify');
const { computeFileChecksum } = require('../../scripts/hooks/post-calc-save');

module.exports = function(ctx) {
  ctx.assert(typeof verifyHook.run === 'function', 'run exported');

  // Non-calc command passes through
  const nonCalc = JSON.stringify({ command: 'ls -la', tool_input: { command: 'ls -la' } });
  ctx.assert(verifyHook.run(nonCalc) === nonCalc, 'non-calc passes through');

  // Calc command without data refs passes through
  const noData = JSON.stringify({ command: 'python -c "print(1+1)"', tool_input: { command: 'python -c "print(1+1)"' } });
  ctx.assert(verifyHook.run(noData) === noData, 'calc without data refs passes through');

  // Setup: create temp data file and checksums
  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-verify-test-' + Date.now());
  const dataDir = path.join(tmpDir, 'output', 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // Create a test data file
  const dataFile = path.join(tmpDir, 'test_data.csv');
  fs.writeFileSync(dataFile, 'id,value\n1,100\n2,200\n', 'utf8');

  process.chdir(tmpDir);

  try {
    const checksumFile = path.join(dataDir, '_data-checksums.json');
    const cs = computeFileChecksum('test_data.csv');

    // Save known checksum
    const checksums = {
      'test_data.csv': { checksum: cs, lastSeen: '2026-05-01T00:00:00Z', script: 'calc_001.py' },
    };
    fs.writeFileSync(checksumFile, JSON.stringify(checksums, null, 2), 'utf8');

    // Same data → no warning (silent pass)
    const withData = JSON.stringify({
      command: 'python -c "import pandas as pd; pd.read_csv(\'test_data.csv\')"',
      tool_input: { command: 'python -c "import pandas as pd; pd.read_csv(\'test_data.csv\')"' },
    });
    const result1 = verifyHook.run(withData);
    ctx.assert(result1 === withData, 'unchanged data passes through');

    // Modify data file
    fs.writeFileSync(dataFile, 'id,value\n1,999\n2,200\n', 'utf8');

    // Changed data → blocks (returns object with exitCode 2)
    const result2 = verifyHook.run(withData);
    ctx.assert(typeof result2 === 'object', 'changed data returns object');
    ctx.assertEqual(result2.exitCode, 2, 'changed data blocks with exitCode 2');
    ctx.assert(result2.stderr.includes('BLOCKED'), 'changed data stderr has BLOCKED');

    // New data file (no saved checksum) → also blocks (warning-level mismatch)
    const newFile = path.join(tmpDir, 'new_data.csv');
    fs.writeFileSync(newFile, 'x\n1\n', 'utf8');
    const withNew = JSON.stringify({
      command: 'python -c "import pandas as pd; pd.read_csv(\'new_data.csv\')"',
      tool_input: { command: 'python -c "import pandas as pd; pd.read_csv(\'new_data.csv\')"' },
    });
    const result3 = verifyHook.run(withNew);
    ctx.assert(typeof result3 === 'object', 'new data file returns object');
    ctx.assertEqual(result3.exitCode, 2, 'new data file blocks with exitCode 2');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
