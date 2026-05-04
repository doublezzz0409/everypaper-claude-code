#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const rl = require('../../scripts/lib/rule-learner');

module.exports = function(ctx) {
  ctx.assert(typeof rl.profileData === 'function', 'profileData exported');
  ctx.assert(typeof rl.learnFromExecution === 'function', 'learnFromExecution exported');
  ctx.assert(typeof rl.getActiveRules === 'function', 'getActiveRules exported');
  ctx.assert(typeof rl.getObserveRules === 'function', 'getObserveRules exported');
  ctx.assert(typeof rl.formatLearnedRules === 'function', 'formatLearnedRules exported');
  ctx.assert(typeof rl.inferColumnType === 'function', 'inferColumnType exported');
  ctx.assert(typeof rl.generateRulesFromProfile === 'function', 'generateRulesFromProfile exported');
  ctx.assert(typeof rl.parseCsvWithStats === 'function', 'parseCsvWithStats exported');

  ctx.assertEqual(rl.inferColumnType('firm_id', {}), 'id', 'firm_id → id');
  ctx.assertEqual(rl.inferColumnType('year', {}), 'temporal', 'year → temporal');
  ctx.assertEqual(rl.inferColumnType('audit_fee', {}), 'amount', 'audit_fee → amount');
  ctx.assertEqual(rl.inferColumnType('roe', {}), 'ratio', 'roe → ratio');
  ctx.assertEqual(rl.inferColumnType('industry_type', {}), 'category', 'industry_type → category');

  ctx.assertEqual(rl.inferColumnType('x', { allUnique: true, allNumeric: true }), 'id', 'unique numeric → id');
  ctx.assertEqual(rl.inferColumnType('x', { allNumeric: true, min: 0, max: 1, stdDev: 0.3 }), 'ratio', '0-1 → ratio');
  ctx.assertEqual(rl.inferColumnType('x', { allNumeric: true, min: 1, max: 5, stdDev: 1 }), 'category', 'small int range → category');
  ctx.assertEqual(rl.inferColumnType('x', { allNumeric: true, min: 100, max: 50000, stdDev: 5000 }), 'continuous', 'large range → continuous');

  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-rl-test-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'data'), { recursive: true });
  process.chdir(tmpDir);

  try {
    const csvFile = path.join(tmpDir, 'test.csv');
    fs.writeFileSync(csvFile, 'firm_id,year,audit_fee\n1,2023,100\n2,2024,200\n3,2023,150\n', 'utf8');
    const parsed = rl.parseCsvWithStats(csvFile);
    ctx.assert(parsed !== null, 'parseCsvWithStats returns data');
    ctx.assertEqual(parsed.rows, 3, '3 rows');
    ctx.assert(parsed.stats.firm_id.allUnique, 'firm_id all unique');
    ctx.assertEqual(parsed.stats.audit_fee.min, 100, 'audit_fee min');
    ctx.assertEqual(parsed.stats.audit_fee.max, 200, 'audit_fee max');

    const profile = rl.profileData(csvFile);
    ctx.assert(profile !== null, 'profileData returns profile');
    ctx.assertEqual(profile.columns.firm_id.type, 'id', 'firm_id inferred as id');
    ctx.assertEqual(profile.columns.year.type, 'temporal', 'year inferred as temporal');
    ctx.assertEqual(profile.columns.audit_fee.type, 'amount', 'audit_fee inferred as amount');

    const rules = rl.generateRulesFromProfile('test.csv', profile);
    ctx.assert(rules.length > 0, 'generates rules');
    ctx.assert(rules.some(r => r.column === 'firm_id' && r.type === 'unique'), 'generates unique rule for id');
    ctx.assert(rules.some(r => r.column === 'audit_fee' && r.type === 'range'), 'generates range rule for amount');
    ctx.assert(rules.every(r => r.state === 'observe'), 'all rules start as observe');

    const result1 = rl.learnFromExecution(csvFile);
    ctx.assert(result1.profile !== null, 'first learn returns profile');
    ctx.assert(result1.newRules.length > 0, 'first learn generates rules');
    ctx.assertEqual(result1.evolvedRules.length, 0, 'first learn no evolutions');

    const active1 = rl.getActiveRules(csvFile);
    ctx.assertEqual(active1.length, 0, 'no active rules after first learn');

    const observe1 = rl.getObserveRules(csvFile);
    ctx.assert(observe1.length > 0, 'observe rules visible after first learn');

    const result2 = rl.learnFromExecution(csvFile);
    ctx.assertEqual(result2.evolvedRules.length, 0, 'second learn no evolutions');

    const result3 = rl.learnFromExecution(csvFile);
    ctx.assert(result3.evolvedRules.length > 0, 'third learn evolves rules');
    ctx.assert(result3.evolvedRules.every(r => r.state === 'confirmed'), 'evolved to confirmed');

    const result4 = rl.learnFromExecution(csvFile);
    ctx.assert(result4.evolvedRules.length > 0, 'fourth learn evolves rules');
    ctx.assert(result4.evolvedRules.every(r => r.state === 'active'), 'evolved to active');

    const active4 = rl.getActiveRules(csvFile);
    ctx.assert(active4.length > 0, 'active rules after fourth learn');

    const fmt = rl.formatLearnedRules(active4);
    ctx.assert(fmt.includes('RuleLearner'), 'format has header');
    ctx.assert(fmt.includes('active'), 'format shows active state');
    ctx.assertEqual(rl.formatLearnedRules([]), '', 'empty rules empty string');

    ctx.assertEqual(rl.parseCsvWithStats('/nonexistent'), null, 'null for missing file');
    ctx.assertEqual(rl.profileData('/nonexistent'), null, 'null for missing file');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
