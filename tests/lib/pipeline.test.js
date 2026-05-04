#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const pipeline = require('../../scripts/lib/pipeline');

module.exports = function(ctx) {
  // Exports
  ctx.assert(typeof pipeline.createPlan === 'function', 'createPlan exported');
  ctx.assert(typeof pipeline.registerSource === 'function', 'registerSource exported');
  ctx.assert(typeof pipeline.recordSourceChange === 'function', 'recordSourceChange exported');
  ctx.assert(typeof pipeline.updateStepCode === 'function', 'updateStepCode exported');
  ctx.assert(typeof pipeline.saveSnapshot === 'function', 'saveSnapshot exported');
  ctx.assert(typeof pipeline.markStale === 'function', 'markStale exported');
  ctx.assert(typeof pipeline.assessImpact === 'function', 'assessImpact exported');
  ctx.assert(typeof pipeline.getStaleSteps === 'function', 'getStaleSteps exported');
  ctx.assert(typeof pipeline.getStepByCode === 'function', 'getStepByCode exported');
  ctx.assert(typeof pipeline.computeResultSnapshot === 'function', 'computeResultSnapshot exported');
  ctx.assert(typeof pipeline.snapshotsMatch === 'function', 'snapshotsMatch exported');
  ctx.assert(typeof pipeline.generateReport === 'function', 'generateReport exported');
  ctx.assert(typeof pipeline.formatTime === 'function', 'formatTime exported');
  ctx.assert(typeof pipeline.nextVersionTag === 'function', 'nextVersionTag exported');
  ctx.assert(typeof pipeline.loadPlan === 'function', 'loadPlan exported');
  ctx.assert(typeof pipeline.savePlan === 'function', 'savePlan exported');
  ctx.assert(typeof pipeline.getLatestSourceTag === 'function', 'getLatestSourceTag exported');

  // formatTime
  const formatted = pipeline.formatTime('2026-05-04T10:30:00.000Z');
  ctx.assert(typeof formatted === 'string', 'formatTime returns string');
  ctx.assert(formatted.includes('2026'), 'formatTime includes year');
  ctx.assertEqual(pipeline.formatTime(null), 'unknown', 'formatTime null returns unknown');
  ctx.assertEqual(pipeline.formatTime(''), 'unknown', 'formatTime empty returns unknown');

  // nextVersionTag
  ctx.assertEqual(pipeline.nextVersionTag([]), 'original', 'empty versions gives original');
  ctx.assertEqual(pipeline.nextVersionTag([{ tag: 'original', time: '' }]), 'v1', 'after original gives v1');
  ctx.assertEqual(pipeline.nextVersionTag([{ tag: 'original', time: '' }, { tag: 'v1', time: '' }]), 'v2', 'after v1 gives v2');
  ctx.assertEqual(pipeline.nextVersionTag([{ tag: 'v5', time: '' }, { tag: 'v3', time: '' }]), 'v6', 'after max v5 gives v6');

  // Temp directory setup for file-based tests
  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-pipeline-test-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'data'), { recursive: true });
  process.chdir(tmpDir);

  try {
    // createPlan
    const plan = pipeline.createPlan('审计收费影响因素', [
      { name: '数据清洗', input: 'annual_report.xlsx', method: '去缺失值', output: 'step1_clean.csv' },
      { name: '描述性统计', input: 'step1_clean.csv', method: '均值标准差', output: 'step2_desc.csv', dependsOn: ['step_001'] },
    ]);

    ctx.assertEqual(plan.research, '审计收费影响因素', 'plan research set');
    ctx.assertEqual(plan.status, 'active', 'plan status is active');
    ctx.assert(plan.created, 'plan has created timestamp');
    ctx.assert(Array.isArray(plan.steps), 'plan has steps array');
    ctx.assertEqual(plan.steps.length, 2, 'plan has 2 steps');
    ctx.assertEqual(plan.steps[0].id, 'step_001', 'step 1 id');
    ctx.assertEqual(plan.steps[0].name, '数据清洗', 'step 1 name');
    ctx.assertEqual(plan.steps[0].status, 'pending', 'step 1 status pending');
    ctx.assertEqual(plan.steps[0].output, 'step1_clean.csv', 'step 1 output');
    ctx.assertEqual(plan.steps[1].dependsOn[0], 'step_001', 'step 2 depends on step 1');
    ctx.assert(plan.history.length > 0, 'plan has history');

    // loadPlan roundtrip
    const loaded = pipeline.loadPlan();
    ctx.assert(loaded !== null, 'loadPlan returns plan');
    ctx.assertEqual(loaded.research, '审计收费影响因素', 'loaded plan research matches');

    // registerSource
    pipeline.registerSource(plan, 'annual_report.xlsx', '原始数据');
    ctx.assert(plan.sources['annual_report.xlsx'], 'source registered');
    ctx.assertEqual(plan.sources['annual_report.xlsx'].versions.length, 1, '1 version');
    ctx.assertEqual(plan.sources['annual_report.xlsx'].versions[0].tag, 'original', 'first version is original');
    ctx.assertEqual(plan.sources['annual_report.xlsx'].versions[0].note, '原始数据', 'note preserved');

    // recordSourceChange
    pipeline.recordSourceChange(plan, 'annual_report.xlsx', '修改Sheet4');
    ctx.assertEqual(plan.sources['annual_report.xlsx'].versions.length, 2, '2 versions after change');
    ctx.assertEqual(plan.sources['annual_report.xlsx'].versions[1].tag, 'v1', 'second version is v1');
    ctx.assertEqual(plan.sources['annual_report.xlsx'].versions[1].note, '修改Sheet4', 'change note preserved');

    // getLatestSourceTag
    ctx.assertEqual(pipeline.getLatestSourceTag(plan), 'v1', 'latest source tag is v1');

    // updateStepCode
    pipeline.updateStepCode(plan, 'step_001', 'calc_001.py');
    ctx.assertEqual(plan.steps[0].code, 'calc_001.py', 'step code set');
    ctx.assertEqual(plan.steps[0].status, 'executed', 'step status executed');
    ctx.assert(plan.steps[0].codeTime, 'step has codeTime');

    // getStepByCode
    ctx.assert(pipeline.getStepByCode(plan, 'calc_001.py') !== null, 'find step by code');
    ctx.assert(pipeline.getStepByCode(plan, 'nonexistent.py') === null, 'null for unknown code');

    // saveSnapshot
    pipeline.saveSnapshot(plan, 'step_001', { rows: 4500, preview: 'firm_id,year\n1,2023' });
    ctx.assertEqual(plan.steps[0].snapshots.length, 1, '1 snapshot');
    ctx.assertEqual(plan.steps[0].snapshots[0].tag, 'v1', 'snapshot tagged with latest source');
    ctx.assertEqual(plan.steps[0].snapshots[0].rows, 4500, 'snapshot rows');
    ctx.assertEqual(plan.steps[0].snapshots[0].match, null, 'snapshot match is null initially');

    // computeResultSnapshot
    const resultFile = path.join(tmpDir, 'output', 'data', 'test_result.csv');
    fs.writeFileSync(resultFile, 'firm_id,year,fee\n1,2023,100000\n2,2024,200000\n', 'utf8');
    const snap = pipeline.computeResultSnapshot(resultFile);
    ctx.assert(snap !== null, 'computeResultSnapshot returns result');
    ctx.assert(typeof snap.checksum === 'string', 'snapshot has checksum');
    ctx.assert(snap.checksum.length === 16, 'checksum is 16 chars');
    ctx.assertEqual(snap.rows, 2, 'snapshot rows count');
    ctx.assert(snap.preview.includes('firm_id'), 'snapshot has preview');

    ctx.assert(pipeline.computeResultSnapshot('/nonexistent/file.csv') === null, 'null for missing file');

    // snapshotsMatch
    const snap1 = { checksum: 'abc123', rows: 100 };
    const snap2 = { checksum: 'abc123', rows: 100 };
    const snap3 = { checksum: 'def456', rows: 200 };
    ctx.assert(pipeline.snapshotsMatch(snap1, snap2), 'matching snapshots');
    ctx.assert(!pipeline.snapshotsMatch(snap1, snap3), 'non-matching snapshots');
    ctx.assert(!pipeline.snapshotsMatch(snap1, null), 'null snapshot does not match');

    // markStale
    pipeline.markStale(plan, 'step_001', '源数据已变更');
    ctx.assertEqual(plan.steps[0].status, 'stale', 'step marked stale');
    ctx.assertEqual(plan.steps[0].staleReason, '源数据已变更', 'stale reason set');
    ctx.assert(plan.steps[0].staleAt, 'staleAt timestamp set');
    ctx.assertEqual(plan.status, 'affected', 'plan status affected');

    // Cascade: step_002 depends on step_001
    ctx.assertEqual(plan.steps[1].status, 'stale', 'dependent step also marked stale');
    ctx.assert(plan.steps[1].staleReason.includes('step_001'), 'cascade reason references upstream');

    // getStaleSteps
    const stale = pipeline.getStaleSteps(plan);
    ctx.assertEqual(stale.length, 2, '2 stale steps');

    // assessImpact
    const affected = pipeline.assessImpact(plan, 'annual_report.xlsx');
    ctx.assert(affected.includes('step_001'), 'step_001 affected by source change');
    ctx.assert(!affected.includes('step_002'), 'step_002 not directly affected (uses step_001 output)');

    // generateReport
    const report = pipeline.generateReport(plan);
    ctx.assert(typeof report === 'string', 'generateReport returns string');
    ctx.assert(report.includes('审计收费影响因素'), 'report includes research');
    ctx.assert(report.includes('有变更'), 'report shows affected status');
    ctx.assert(report.includes('源数据版本'), 'report has source versions section');
    ctx.assert(report.includes('执行步骤'), 'report has steps section');
    ctx.assert(report.includes('影响评估'), 'report has impact section');

    ctx.assertEqual(pipeline.generateReport(null), '无研究计划。', 'null plan returns message');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
