#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const br = require('../../scripts/lib/business-rules');

module.exports = function(ctx) {
  ctx.assert(typeof br.DEFAULT_RULES === 'object', 'DEFAULT_RULES exported');
  ctx.assert(typeof br.loadRules === 'function', 'loadRules exported');
  ctx.assert(typeof br.saveRules === 'function', 'saveRules exported');
  ctx.assert(typeof br.parseCsv === 'function', 'parseCsv exported');
  ctx.assert(typeof br.checkRule === 'function', 'checkRule exported');
  ctx.assert(typeof br.runBusinessRules === 'function', 'runBusinessRules exported');
  ctx.assert(typeof br.formatRuleIssues === 'function', 'formatRuleIssues exported');

  ctx.assert(br.DEFAULT_RULES.length > 0, 'has default rules');
  ctx.assert(br.DEFAULT_RULES[0].id, 'rules have id');

  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-br-test-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'data'), { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  process.chdir(tmpDir);

  try {
    const csvFile = path.join(tmpDir, 'test.csv');
    fs.writeFileSync(csvFile, 'firm_id,year,audit_fee\n1,2023,100\n2,2024,200\n', 'utf8');
    const parsed = br.parseCsv(csvFile);
    ctx.assert(parsed !== null, 'parseCsv returns data');
    ctx.assertEqual(parsed.header.length, 3, '3 columns');
    ctx.assertEqual(parsed.rows.length, 2, '2 rows');

    ctx.assertEqual(br.parseCsv('/nonexistent'), null, 'null for missing');

    const passRule = { type: 'range', column: 'audit_fee', min: 0, max: null, severity: 'critical' };
    ctx.assert(br.checkRule(passRule, csvFile) === null, 'range rule passes');

    const failFile = path.join(tmpDir, 'fail.csv');
    fs.writeFileSync(failFile, 'audit_fee\n100\n-50\n200\n', 'utf8');
    const failRule = { type: 'range', column: 'audit_fee', min: 0, max: null, severity: 'critical' };
    const failResult = br.checkRule(failRule, failFile);
    ctx.assert(failResult !== null, 'range rule fails');
    ctx.assertEqual(failResult.level, 'critical', 'correct severity');

    const nullFile = path.join(tmpDir, 'nulls.csv');
    fs.writeFileSync(nullFile, 'firm_id\n1\n\n3\nNA\n', 'utf8');
    const nullRule = { type: 'not_null', column: 'firm_id', threshold: 0.01, severity: 'critical' };
    ctx.assert(br.checkRule(nullRule, nullFile) !== null, 'not_null catches nulls');

    const smallFile = path.join(tmpDir, 'small.csv');
    fs.writeFileSync(smallFile, 'a\n1\n2\n3\n', 'utf8');
    const rowsRule = { type: 'min_rows', minRows: 100, severity: 'warning' };
    const rowsResult = br.checkRule(rowsRule, smallFile);
    ctx.assert(rowsResult !== null, 'min_rows catches small data');

    const allNullFile = path.join(tmpDir, 'allnull.csv');
    fs.writeFileSync(allNullFile, 'a,b\n,1\n,2\n', 'utf8');
    const allNullRule = { type: 'no_all_null', severity: 'warning' };
    ctx.assert(br.checkRule(allNullRule, allNullFile) !== null, 'no_all_null catches all-null col');

    const dupFile = path.join(tmpDir, 'dup.csv');
    fs.writeFileSync(dupFile, 'firm_id,x\n1,a\n1,b\n2,c\n', 'utf8');
    const uniqRule = { type: 'unique', columnPatterns: ['firm_id'], severity: 'critical' };
    ctx.assert(br.checkRule(uniqRule, dupFile) !== null, 'unique catches duplicates');

    const brResult = br.runBusinessRules(csvFile);
    ctx.assert(brResult.ok === true, 'good data passes rules');

    const fmt = br.formatRuleIssues([{ level: 'critical', message: 'test error' }]);
    ctx.assert(fmt.includes('BusinessRules'), 'format has header');
    ctx.assert(fmt.includes('❌'), 'format has icon');
    ctx.assertEqual(br.formatRuleIssues([]), '', 'empty issues empty string');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
