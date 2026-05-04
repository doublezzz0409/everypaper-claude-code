#!/usr/bin/env node
/**
 * Stop Hook — Pipeline Full Report
 *
 * At session end, generates a comprehensive pipeline report:
 * - Step execution summary
 * - Data change history
 * - Result comparison (original vs latest)
 * - Verification record
 * - Code archive listing
 * - Flow diagram generation
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getOutputDir, log, ensureDir } = require('../lib/utils');
const pipeline = require('../lib/pipeline');
const flowDiagram = require('../lib/flow-diagram');

function run(rawInput) {
  try {
    const plan = pipeline.loadPlan();
    if (!plan) return rawInput;

    const lines = [];
    const divider = '═'.repeat(60);

    lines.push(`\n${divider}`);
    lines.push(`  研究流程汇报: ${plan.research}`);
    lines.push(`  生成时间: ${pipeline.formatTime(new Date().toISOString())}`);
    lines.push(divider);

    // Step execution summary
    lines.push('');
    lines.push('  步骤执行:');
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const icon = step.status === 'executed' ? '✅' :
        step.status === 'stale' ? '❌' : '⏳';
      const codeInfo = step.code ? `  ${step.code}` : '  未执行';
      const snapInfo = step.snapshots.length > 0 ?
        `  [${step.snapshots[step.snapshots.length - 1].tag}]` : '';
      lines.push(`    ${icon} Step ${i + 1}: ${step.name}${codeInfo}${snapInfo}`);
    }

    // Data changes
    const sourceFiles = Object.keys(plan.sources);
    if (sourceFiles.length > 0) {
      lines.push('');
      lines.push('  数据变更:');
      for (const file of sourceFiles) {
        const versions = plan.sources[file].versions;
        if (versions.length > 1) {
          const first = versions[0];
          const last = versions[versions.length - 1];
          lines.push(`    📝 ${file}: ${first.tag} → ${last.tag} (${versions.length - 1}次修改)`);
        } else {
          lines.push(`    ✅ ${file}: ${versions[0].tag} (未修改)`);
        }
      }
    }

    // Result comparison
    const executedSteps = plan.steps.filter(s => s.snapshots.length >= 2);
    if (executedSteps.length > 0) {
      lines.push('');
      lines.push('  结果比对:');
      for (const step of executedSteps) {
        const first = step.snapshots[0];
        const last = step.snapshots[step.snapshots.length - 1];
        if (first.rows !== null && last.rows !== null) {
          const match = first.checksum === last.checksum;
          const icon = match ? '✅' : '❌';
          lines.push(`    ${icon} ${step.name}: ${first.rows}行 → ${last.rows}行 (${first.tag} → ${last.tag})`);
        }
      }
    }

    // Verification record
    const staleSteps = pipeline.getStaleSteps(plan);
    lines.push('');
    lines.push('  验证记录:');
    lines.push(`    总步骤: ${plan.steps.length}`);
    lines.push(`    已执行: ${plan.steps.filter(s => s.status === 'executed').length}`);
    lines.push(`    待执行: ${plan.steps.filter(s => s.status === 'pending').length}`);
    lines.push(`    已过期: ${staleSteps.length}`);
    if (plan.status === 'affected') {
      lines.push(`    ⚠️ 状态: 有变更，需要重跑`);
    } else {
      lines.push(`    ✅ 状态: 正常`);
    }

    // Code archive listing
    const outputDir = getOutputDir();
    const scriptsDir = path.join(outputDir, 'data', 'scripts');
    if (fs.existsSync(scriptsDir)) {
      const scriptFiles = fs.readdirSync(scriptsDir)
        .filter(f => (f.startsWith('calc_') && (f.endsWith('.py') || f.endsWith('.R'))))
        .sort();
      if (scriptFiles.length > 0) {
        lines.push('');
        lines.push('  代码归档:');
        for (const f of scriptFiles) {
          lines.push(`    📄 output/data/scripts/${f}`);
        }
      }
    }

    lines.push(divider);

    // Generate flow diagram
    try {
      flowDiagram.generateAndSave(plan);
      lines.push('');
      lines.push('  📊 流程图已更新: output/data/flow-diagram.md');
    } catch {
      // Best-effort
    }

    // Output to stderr
    process.stderr.write(lines.join('\n') + '\n');

    log('Pipeline', `Full report generated for: ${plan.research}`);

    return rawInput;
  } catch {
    return rawInput;
  }
}

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    const result = run(input);
    process.stdout.write(result);
  });
}

module.exports = { run };
