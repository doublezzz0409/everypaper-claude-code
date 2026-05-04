#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const verify = require('../../scripts/lib/verify-output');

module.exports = function(ctx) {
  ctx.assert(typeof verify.verifyFileExists === 'function', 'verifyFileExists exported');
  ctx.assert(typeof verify.compareWithPrevious === 'function', 'compareWithPrevious exported');
  ctx.assert(typeof verify.verifyColumns === 'function', 'verifyColumns exported');
  ctx.assert(typeof verify.countNulls === 'function', 'countNulls exported');
  ctx.assert(typeof verify.checkRegression === 'function', 'checkRegression exported');
  ctx.assert(typeof verify.checkDescriptive === 'function', 'checkDescriptive exported');
  ctx.assert(typeof verify.formatIssues === 'function', 'formatIssues exported');
  ctx.assert(typeof verify.highestSeverity === 'function', 'highestSeverity exported');

  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-verify-test-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // verifyFileExists
    const testFile = path.join(tmpDir, 'test.csv');
    fs.writeFileSync(testFile, 'a,b\n1,2\n', 'utf8');
    const r1 = verify.verifyFileExists(testFile);
    ctx.assert(r1.ok === true, 'existing file ok');
    ctx.assert(r1.error === null, 'existing file no error');

    const r2 = verify.verifyFileExists('/nonexistent/file.csv');
    ctx.assert(r2.ok === false, 'missing file not ok');
    ctx.assert(r2.error.includes('不存在'), 'missing file error');

    const emptyFile = path.join(tmpDir, 'empty.csv');
    fs.writeFileSync(emptyFile, '', 'utf8');
    const r3 = verify.verifyFileExists(emptyFile);
    ctx.assert(r3.ok === false, 'empty file not ok');

    // verifyColumns
    const csvFile = path.join(tmpDir, 'cols.csv');
    fs.writeFileSync(csvFile, 'firm_id,year,audit_fee\n1,2023,100\n', 'utf8');
    const c1 = verify.verifyColumns(csvFile, ['firm_id', 'year', 'audit_fee']);
    ctx.assert(c1.ok === true, 'all columns present');
    const c2 = verify.verifyColumns(csvFile, ['firm_id', 'missing']);
    ctx.assert(c2.ok === false, 'missing column detected');

    // countNulls
    const nullFile = path.join(tmpDir, 'nulls.csv');
    fs.writeFileSync(nullFile, 'a,b\n1,hello\n,world\n3,\n4,NA\n', 'utf8');
    const n1 = verify.countNulls(nullFile, 'a');
    ctx.assertEqual(n1.nullCount, 1, '1 null in col a');
    const n2 = verify.countNulls(nullFile, 'b');
    ctx.assertEqual(n2.nullCount, 2, '2 nulls in col b');

    // checkRegression - normal
    const rr = verify.checkRegression({ coefficients: [{ name: 'x', value: 1.5, pValue: 0.03 }], rSquared: 0.45, sampleSize: 500 });
    ctx.assertEqual(rr.length, 0, 'normal regression no issues');

    // checkRegression - large coef
    const rr2 = verify.checkRegression({ coefficients: [{ name: 'x', value: 150, pValue: 0.03 }] });
    ctx.assert(rr2.length > 0 && rr2[0].level === 'warning', 'large coef warning');

    // checkRegression - bad p-value
    const rr3 = verify.checkRegression({ coefficients: [{ name: 'x', value: 1, pValue: 1.5 }] });
    ctx.assert(rr3.length > 0 && rr3[0].level === 'critical', 'bad p critical');

    // checkRegression - R-squared
    const rr4 = verify.checkRegression({ rSquared: -0.1 });
    ctx.assert(rr4.length > 0 && rr4[0].level === 'critical', 'neg R2 critical');

    // checkRegression - small sample
    const rr5 = verify.checkRegression({ sampleSize: 15 });
    ctx.assert(rr5.length > 0, 'small sample flagged');

    // checkDescriptive - normal
    const dd = verify.checkDescriptive({ variables: [{ name: 'x', mean: 5, stdDev: 1, min: 0, max: 10, count: 100 }] }, 100);
    ctx.assertEqual(dd.length, 0, 'normal desc no issues');

    // checkDescriptive - zero std dev
    const dd2 = verify.checkDescriptive({ variables: [{ name: 'c', mean: 5, stdDev: 0, min: 5, max: 5, count: 100 }] }, 100);
    ctx.assert(dd2.length > 0, 'zero std dev flagged');

    // checkDescriptive - min > max
    const dd3 = verify.checkDescriptive({ variables: [{ name: 'b', mean: 5, stdDev: 1, min: 10, max: 0, count: 100 }] }, 100);
    ctx.assert(dd3.length > 0 && dd3[0].level === 'critical', 'min > max critical');

    // formatIssues
    const f = verify.formatIssues('step', [{ level: 'critical', message: 'err' }]);
    ctx.assert(f.includes('step') && f.includes('❌'), 'format includes step and icon');
    ctx.assertEqual(verify.formatIssues('s', []), '', 'empty issues empty string');

    // highestSeverity
    ctx.assertEqual(verify.highestSeverity([]), 'ok', 'no issues ok');
    ctx.assertEqual(verify.highestSeverity([{ level: 'critical' }, { level: 'warning' }]), 'critical', 'mixed critical');

    // checkReproducibility — exported
    ctx.assert(typeof verify.checkReproducibility === 'function', 'checkReproducibility exported');
    ctx.assert(typeof verify.checkInputChanged === 'function', 'checkInputChanged exported');

    // same output → reproducible
    const step1 = { input: 'data.csv', snapshots: [{ checksum: 'abc123', time: '2026-01-01', rows: 100 }] };
    const snap1 = { checksum: 'abc123', rows: 100 };
    const rep1 = verify.checkReproducibility(step1, snap1, {});
    ctx.assert(rep1.reproducible === true, 'same output is reproducible');

    // different output, no input change info → not reproducible
    const step2 = { input: 'data.csv', snapshots: [{ checksum: 'abc123', time: '2026-01-01', rows: 100 }] };
    const snap2 = { checksum: 'def456', rows: 90 };
    const savedChecksums = { 'data.csv': { checksum: 'original', lastSeen: '2025-12-01', script: 'calc_001.py' } };
    const rep2 = verify.checkReproducibility(step2, snap2, savedChecksums);
    ctx.assert(rep2.reproducible === false, 'different output same input not reproducible');
    ctx.assert(rep2.issues.length > 0, 'has reproducibility issues');

    // different output, input also changed → reproducible (expected change)
    const step3 = { input: 'data.csv', snapshots: [{ checksum: 'abc123', time: '2026-01-01', rows: 100 }] };
    const snap3 = { checksum: 'def456', rows: 90 };
    const savedChecksums2 = { 'data.csv': { checksum: 'new', lastSeen: '2026-02-01', script: 'calc_002.py' } };
    const rep3 = verify.checkReproducibility(step3, snap3, savedChecksums2);
    ctx.assert(rep3.reproducible === true, 'different output with changed input is expected');

    // no previous snapshots → reproducible
    const step4 = { input: 'data.csv', snapshots: [] };
    const rep4 = verify.checkReproducibility(step4, snap1, {});
    ctx.assert(rep4.reproducible === true, 'no snapshots is reproducible');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
