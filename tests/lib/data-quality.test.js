#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const dq = require('../../scripts/lib/data-quality');

module.exports = function(ctx) {
  ctx.assert(typeof dq.checkEmptyFile === 'function', 'checkEmptyFile exported');
  ctx.assert(typeof dq.checkEncoding === 'function', 'checkEncoding exported');
  ctx.assert(typeof dq.parseCsvHeader === 'function', 'parseCsvHeader exported');
  ctx.assert(typeof dq.countRows === 'function', 'countRows exported');
  ctx.assert(typeof dq.checkNullRate === 'function', 'checkNullRate exported');
  ctx.assert(typeof dq.isAllNA === 'function', 'isAllNA exported');
  ctx.assert(typeof dq.detectAllNAColumns === 'function', 'detectAllNAColumns exported');
  ctx.assert(typeof dq.checkValueRange === 'function', 'checkValueRange exported');
  ctx.assert(typeof dq.detectDuplicateRows === 'function', 'detectDuplicateRows exported');
  ctx.assert(typeof dq.runQualityCheck === 'function', 'runQualityCheck exported');
  ctx.assert(typeof dq.formatQualityIssues === 'function', 'formatQualityIssues exported');

  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-dq-test-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const r1 = dq.checkEmptyFile('/nonexistent/file.csv');
    ctx.assert(r1.ok === false, 'missing file not ok');

    const emptyFile = path.join(tmpDir, 'empty.csv');
    fs.writeFileSync(emptyFile, '', 'utf8');
    const r2 = dq.checkEmptyFile(emptyFile);
    ctx.assert(r2.ok === false, 'empty file not ok');

    const goodFile = path.join(tmpDir, 'good.csv');
    fs.writeFileSync(goodFile, 'a,b\n1,2\n', 'utf8');
    const r3 = dq.checkEmptyFile(goodFile);
    ctx.assert(r3.ok === true, 'good file ok');

    const enc1 = dq.checkEncoding(goodFile);
    ctx.assert(enc1.ok === true, 'valid encoding ok');

    const hdr = dq.parseCsvHeader(goodFile);
    ctx.assert(Array.isArray(hdr), 'header is array');
    ctx.assertEqual(hdr[0], 'a', 'header col 0');
    ctx.assertEqual(hdr[1], 'b', 'header col 1');
    ctx.assertEqual(dq.parseCsvHeader('/nonexistent'), null, 'null for missing');

    ctx.assertEqual(dq.countRows(goodFile), 1, '1 data row');
    ctx.assertEqual(dq.countRows('/nonexistent'), -1, '-1 for missing');

    const nullFile = path.join(tmpDir, 'nulls.csv');
    fs.writeFileSync(nullFile, 'a,b\n1,hello\n,world\n3,\n4,NA\n', 'utf8');
    const n1 = dq.checkNullRate(nullFile, 'a', 0.5);
    ctx.assert(n1.ok === true, 'col a under threshold');
    ctx.assertEqual(n1.nullCount, 1, '1 null in a');
    const n2 = dq.checkNullRate(nullFile, 'b', 0.1);
    ctx.assert(n2.ok === false, 'col b over threshold');

    const allNaFile = path.join(tmpDir, 'allna.csv');
    fs.writeFileSync(allNaFile, 'a,b\n,1\n,2\n,3\n', 'utf8');
    ctx.assert(dq.isAllNA(allNaFile, 'a') === true, 'col a is all NA');
    ctx.assert(dq.isAllNA(allNaFile, 'b') === false, 'col b is not all NA');

    const naCols = dq.detectAllNAColumns(allNaFile);
    ctx.assert(naCols.includes('a'), 'detects all-NA col a');
    ctx.assert(!naCols.includes('b'), 'does not flag col b');

    const rangeFile = path.join(tmpDir, 'range.csv');
    fs.writeFileSync(rangeFile, 'x\n5\n10\n15\n20\n', 'utf8');
    const rv1 = dq.checkValueRange(rangeFile, 'x', 0, 15);
    ctx.assert(rv1.ok === false, 'values out of range');
    ctx.assertEqual(rv1.violations, 1, '1 violation');
    const rv2 = dq.checkValueRange(rangeFile, 'x', 0, 100);
    ctx.assert(rv2.ok === true, 'all in range');

    const dupFile = path.join(tmpDir, 'dup.csv');
    fs.writeFileSync(dupFile, 'a,b\n1,2\n3,4\n1,2\n', 'utf8');
    const dd = dq.detectDuplicateRows(dupFile);
    ctx.assert(dd.ok === false, 'has duplicates');
    ctx.assertEqual(dd.duplicateCount, 1, '1 duplicate');

    const noDupFile = path.join(tmpDir, 'nodup.csv');
    fs.writeFileSync(noDupFile, 'a,b\n1,2\n3,4\n', 'utf8');
    const dd2 = dq.detectDuplicateRows(noDupFile);
    ctx.assert(dd2.ok === true, 'no duplicates');

    const qc1 = dq.runQualityCheck(goodFile);
    ctx.assert(qc1.ok === true, 'good file passes quality');
    ctx.assert(qc1.summary.rows === 1, 'summary has rows');

    const qc2 = dq.runQualityCheck(emptyFile);
    ctx.assert(qc2.ok === false, 'empty file fails quality');

    const fmt = dq.formatQualityIssues('test.csv', [{ level: 'critical', message: 'err' }]);
    ctx.assert(fmt.includes('test.csv'), 'format includes filename');
    ctx.assert(fmt.includes('❌'), 'format includes icon');
    ctx.assertEqual(dq.formatQualityIssues('x', []), '', 'empty issues empty string');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
