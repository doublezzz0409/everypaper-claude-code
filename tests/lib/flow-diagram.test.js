#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const flowDiagram = require('../../scripts/lib/flow-diagram');
const pipeline = require('../../scripts/lib/pipeline');

module.exports = function(ctx) {
  // Exports
  ctx.assert(typeof flowDiagram.generateMermaid === 'function', 'generateMermaid exported');
  ctx.assert(typeof flowDiagram.generateAscii === 'function', 'generateAscii exported');
  ctx.assert(typeof flowDiagram.generateAndSave === 'function', 'generateAndSave exported');
  ctx.assert(typeof flowDiagram.DIAGRAM_FILE === 'function', 'DIAGRAM_FILE exported');

  // generateMermaid with null plan
  const emptyMermaid = flowDiagram.generateMermaid(null);
  ctx.assert(emptyMermaid.includes('无研究计划'), 'mermaid null plan message');

  // generateAscii with null plan
  const emptyAscii = flowDiagram.generateAscii(null);
  ctx.assertEqual(emptyAscii, '无研究计划。', 'ascii null plan message');

  // generateMermaid with empty steps
  const emptyPlanMermaid = flowDiagram.generateMermaid({ steps: [], sources: {} });
  ctx.assert(emptyPlanMermaid.includes('无研究计划'), 'mermaid empty plan message');

  // Temp directory setup
  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-flow-test-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'data'), { recursive: true });
  process.chdir(tmpDir);

  try {
    // Create a real plan for testing
    const plan = pipeline.createPlan('审计收费影响因素', [
      { name: '数据清洗', input: 'annual_report.xlsx', method: '去缺失值', output: 'step1_clean.csv' },
      { name: '描述性统计', input: 'step1_clean.csv', method: '均值标准差', output: 'step2_desc.csv', dependsOn: ['step_001'] },
    ]);
    pipeline.registerSource(plan, 'annual_report.xlsx', '原始数据');
    pipeline.updateStepCode(plan, 'step_001', 'calc_001.py');
    pipeline.saveSnapshot(plan, 'step_001', { rows: 4500 });

    // generateMermaid
    const mermaid = flowDiagram.generateMermaid(plan);
    ctx.assert(mermaid.includes('```mermaid'), 'mermaid has code fence');
    ctx.assert(mermaid.includes('graph TD'), 'mermaid has graph directive');
    ctx.assert(mermaid.includes('annual_report'), 'mermaid includes source file');
    ctx.assert(mermaid.includes('数据清洗'), 'mermaid includes step name');
    ctx.assert(mermaid.includes('step_001'), 'mermaid includes step id');
    ctx.assert(mermaid.includes('style'), 'mermaid has style directives');

    // generateAscii
    const ascii = flowDiagram.generateAscii(plan);
    ctx.assert(ascii.includes('审计收费影响因素'), 'ascii includes research title');
    ctx.assert(ascii.includes('源数据'), 'ascii has source section');
    ctx.assert(ascii.includes('annual_report.xlsx'), 'ascii includes source file');
    ctx.assert(ascii.includes('original'), 'ascii includes version tag');
    ctx.assert(ascii.includes('Step 1'), 'ascii has step numbering');
    ctx.assert(ascii.includes('数据清洗'), 'ascii includes step name');
    ctx.assert(ascii.includes('calc_001.py'), 'ascii includes code file');
    ctx.assert(ascii.includes('4500行'), 'ascii includes snapshot rows');

    // Mark stale and check impact display
    pipeline.markStale(plan, 'step_001', '源数据已变更');
    const staleAscii = flowDiagram.generateAscii(plan);
    ctx.assert(staleAscii.includes('过期'), 'ascii shows stale status');
    ctx.assert(staleAscii.includes('影响评估'), 'ascii has impact section');
    ctx.assert(staleAscii.includes('源数据已变更'), 'ascii shows stale reason');

    // generateAndSave
    const result = flowDiagram.generateAndSave(plan);
    ctx.assert(result.mermaid, 'generateAndSave returns mermaid');
    ctx.assert(result.ascii, 'generateAndSave returns ascii');

    const diagramFile = path.join(tmpDir, 'output', 'data', 'flow-diagram.md');
    ctx.assert(fs.existsSync(diagramFile), 'flow-diagram.md created');
    const content = fs.readFileSync(diagramFile, 'utf8');
    ctx.assert(content.includes('# 数据流图'), 'diagram file has title');
    ctx.assert(content.includes('## Mermaid'), 'diagram has mermaid section');
    ctx.assert(content.includes('## ASCII'), 'diagram has ascii section');
    ctx.assert(content.includes('```mermaid'), 'diagram contains mermaid code');
    ctx.assert(content.includes('生成时间'), 'diagram has generation time');

    // generateAndSave with no plan (no plan.json)
    fs.unlinkSync(path.join(tmpDir, 'output', 'data', 'plan.json'));
    const noResult = flowDiagram.generateAndSave(null);
    ctx.assert(noResult.ascii === '无研究计划。', 'no plan returns fallback');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
