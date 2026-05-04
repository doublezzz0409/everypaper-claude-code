#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const hook = require('../../scripts/hooks/post-calc-save');

module.exports = function(ctx) {
  // Exports
  ctx.assert(typeof hook.run === 'function', 'run exported');
  ctx.assert(Array.isArray(hook.CODE_PATTERNS), 'CODE_PATTERNS exported');
  ctx.assert(typeof hook.extractDataRefs === 'function', 'extractDataRefs exported');
  ctx.assert(typeof hook.computeFileChecksum === 'function', 'computeFileChecksum exported');
  ctx.assert(typeof hook.loadDataChecksums === 'function', 'loadDataChecksums exported');
  ctx.assert(typeof hook.saveDataChecksums === 'function', 'saveDataChecksums exported');

  // extractDataRefs
  const refs1 = hook.extractDataRefs('pd.read_csv("data.csv")', '');
  ctx.assert(refs1.includes('data.csv'), 'extracts csv from code');

  const refs2 = hook.extractDataRefs('', 'python analyze.py --file results.xlsx');
  ctx.assert(refs2.includes('results.xlsx'), 'extracts xlsx from command');

  const refs3 = hook.extractDataRefs('import pandas as pd', 'python test.py');
  ctx.assert(refs3.length === 0, 'no refs when no data files');

  // Non-calculation command passes through unchanged
  const nonCalc = JSON.stringify({ command: 'ls -la', tool_input: { command: 'ls -la' } });
  const passResult = hook.run(nonCalc);
  ctx.assert(passResult === nonCalc, 'non-calc command passes through');

  // Inline Python code is saved
  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-calc-test-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'data', 'scripts'), { recursive: true });
  process.chdir(tmpDir);

  try {
    const input = JSON.stringify({
      command: 'python -c "import numpy as np; print(np.mean([1,2,3]))"',
      tool_input: { command: 'python -c "import numpy as np; print(np.mean([1,2,3]))"' },
      output: '2.0',
      exit_code: 0,
      result: { stdout: '2.0', exit_code: 0 },
    });

    const result = hook.run(input);
    ctx.assert(result === input, 'returns original input unchanged');

    const scriptsDir = path.join(tmpDir, 'output', 'data', 'scripts');
    const calcFile = path.join(scriptsDir, 'calc_001.py');
    ctx.assert(fs.existsSync(calcFile), 'calc_001.py created');

    const content = fs.readFileSync(calcFile, 'utf8');
    ctx.assert(content.includes('numpy'), 'saved code contains original code');
    ctx.assert(content.includes('Calculation Script #1'), 'has metadata header');
    ctx.assert(content.includes('Timestamp:'), 'has timestamp');
    ctx.assert(content.includes('Language: python'), 'has language');

    const metaFile = path.join(scriptsDir, 'calc_001_meta.json');
    ctx.assert(fs.existsSync(metaFile), 'meta file created');
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    ctx.assertEqual(meta.number, 1, 'meta number is 1');
    ctx.assertEqual(meta.lang, 'python', 'meta lang is python');
    ctx.assertEqual(meta.type, 'inline', 'meta type is inline');
    ctx.assert(meta.checksum, 'meta has checksum');
    ctx.assert(meta.timestamp, 'meta has timestamp');
    ctx.assertEqual(meta.exitCode, 0, 'meta exitCode is 0');

    const indexFile = path.join(scriptsDir, '_index.json');
    ctx.assert(fs.existsSync(indexFile), 'index file created');
    const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    ctx.assertEqual(index.lastNumber, 1, 'index lastNumber is 1');
    ctx.assert(index.scripts.length === 1, 'index has 1 entry');
    ctx.assertEqual(index.scripts[0].file, 'calc_001.py', 'index entry file correct');

    // Second calculation increments number
    const input2 = JSON.stringify({
      command: 'python -c "print(42)"',
      tool_input: { command: 'python -c "print(42)"' },
      output: '42',
      exit_code: 0,
      result: { stdout: '42', exit_code: 0 },
    });
    hook.run(input2);

    const calcFile2 = path.join(scriptsDir, 'calc_002.py');
    ctx.assert(fs.existsSync(calcFile2), 'calc_002.py created');

    const index2 = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    ctx.assertEqual(index2.lastNumber, 2, 'index lastNumber is 2');
    ctx.assert(index2.scripts.length === 2, 'index has 2 entries');

    // R code is saved with .R extension
    const rInput = JSON.stringify({
      command: 'Rscript -e "cat(mean(c(1,2,3)))"',
      tool_input: { command: 'Rscript -e "cat(mean(c(1,2,3)))"' },
      output: '2',
      exit_code: 0,
      result: { stdout: '2', exit_code: 0 },
    });
    hook.run(rInput);

    const rFile = path.join(scriptsDir, 'calc_003.R');
    ctx.assert(fs.existsSync(rFile), 'R file saved with .R extension');
    const rContent = fs.readFileSync(rFile, 'utf8');
    ctx.assert(rContent.includes('Language: r'), 'R file has correct language');
    ctx.assert(rContent.includes('mean'), 'R file contains code');

    // Create dummy data file for checksum test
    const annualReport = path.join(tmpDir, 'annual_report.csv');
    fs.writeFileSync(annualReport, 'firm_id,year,audit_fee\n1,2023,100000\n', 'utf8');

    // Data refs extracted from code with data files
    const dataInput = JSON.stringify({
      command: 'python -c "import pandas as pd; df = pd.read_csv(\'annual_report.csv\'); print(df.describe())"',
      tool_input: { command: 'python -c "import pandas as pd; df = pd.read_csv(\'annual_report.csv\'); print(df.describe())"' },
      output: '...',
      exit_code: 0,
      result: { stdout: '...', exit_code: 0 },
    });
    hook.run(dataInput);

    const dataMeta = JSON.parse(fs.readFileSync(path.join(scriptsDir, 'calc_004_meta.json'), 'utf8'));
    ctx.assert(dataMeta.dataRefs.includes('annual_report.csv'), 'data refs extracted from code');

    // computeFileChecksum returns hash for existing file
    const testFile = path.join(tmpDir, 'test_checksum.csv');
    fs.writeFileSync(testFile, 'a,b\n1,2\n', 'utf8');
    const cs = hook.computeFileChecksum(testFile);
    ctx.assert(typeof cs === 'string', 'checksum is string');
    ctx.assert(cs.length === 16, 'checksum is 16 chars');
    ctx.assert(hook.computeFileChecksum('/nonexistent/file.csv') === null, 'null for missing file');

    // saveDataChecksums + loadDataChecksums roundtrip
    const existing = hook.loadDataChecksums();
    existing['data.csv'] = { checksum: 'abc123', lastSeen: '2026-01-01', script: 'calc_001.py' };
    hook.saveDataChecksums(existing);
    const loaded = hook.loadDataChecksums();
    ctx.assert(loaded['data.csv'].checksum === 'abc123', 'checksums roundtrip');

    // _data-checksums.json created after calc with data refs
    const checksumsFile = path.join(tmpDir, 'output', 'data', '_data-checksums.json');
    ctx.assert(fs.existsSync(checksumsFile), '_data-checksums.json created');
    const allChecksums = JSON.parse(fs.readFileSync(checksumsFile, 'utf8'));
    ctx.assert(allChecksums['annual_report.csv'], 'annual_report.csv in checksums');
    ctx.assert(allChecksums['annual_report.csv'].checksum, 'has checksum value');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
