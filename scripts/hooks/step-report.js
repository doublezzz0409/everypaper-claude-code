#!/usr/bin/env node
/**
 * PostToolUse:Bash Hook — Step Report
 *
 * After each calculation execution, generates a structured step report
 * showing: status, code file, output file, row count, verification results,
 * and data flow.
 */

'use strict';

const path = require('path');
const { getOutputDir, log, getTimestamp } = require('../lib/utils');
const pipeline = require('../lib/pipeline');
const verify = require('../lib/verify-output');
const { CODE_PATTERNS } = require('./post-calc-save');

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const command = data.command || data.tool_input?.command || '';
    const exitCode = data.exit_code || data.result?.exit_code || 0;

    // Only report for calculation commands
    let isCalc = false;
    for (const pat of CODE_PATTERNS) {
      if (pat.regex.test(command)) {
        isCalc = true;
        break;
      }
    }
    if (!isCalc) return rawInput;

    // Load plan
    const plan = pipeline.loadPlan();
    if (!plan) return rawInput;

    // Find the step that was just executed
    const executedSteps = plan.steps.filter(s => s.status === 'executed');
    if (executedSteps.length === 0) return rawInput;

    const step = executedSteps[executedSteps.length - 1];
    const stepIndex = plan.steps.indexOf(step) + 1;
    const totalSteps = plan.steps.length;

    // Build report
    const lines = [];
    const divider = '═'.repeat(50);

    lines.push(`\n${divider}`);
    lines.push(`  步骤 ${stepIndex}/${totalSteps}: ${step.name}`);
    lines.push(divider);

    // Status
    const statusIcon = exitCode === 0 ? '✅' : '❌';
    lines.push(`  状态: ${statusIcon} ${exitCode === 0 ? '完成' : '失败 (exit ' + exitCode + ')'}`);

    // Code file
    if (step.code) {
      lines.push(`  代码: ${step.code}`);
    }

    // Output verification
    if (step.output && exitCode === 0) {
      const outputDir = getOutputDir();
      const outputPath = path.join(outputDir, 'data', step.output);
      const existCheck = verify.verifyFileExists(outputPath);

      lines.push('');
      lines.push('  输出验证:');

      if (!existCheck.ok) {
        lines.push(`    ❌ ${existCheck.error}`);
      } else {
        const snap = pipeline.computeResultSnapshot(outputPath);
        lines.push(`    ✅ ${step.output} 已生成`);

        if (snap) {
          lines.push(`    ✅ 行数: ${snap.rows}`);

          // Compare with previous snapshot
          if (step.snapshots.length > 1) {
            const prevSnap = step.snapshots[step.snapshots.length - 2];
            if (prevSnap.rows !== null) {
              const delta = snap.rows - prevSnap.rows;
              if (delta !== 0) {
                const pct = ((Math.abs(delta) / prevSnap.rows) * 100).toFixed(1);
                lines.push(`    📊 行数变化: ${prevSnap.rows} → ${snap.rows} (${delta > 0 ? '+' : ''}${delta}, ${pct}%)`);
              } else {
                lines.push(`    📊 行数不变: ${snap.rows}`);
              }
            }
          }

          lines.push(`    🔑 checksum: ${snap.checksum}`);
        }
      }
    }

    // Data flow
    lines.push('');
    lines.push('  数据流:');
    if (step.input) {
      lines.push(`    输入: ${step.input}`);
    }
    lines.push(`    处理: ${step.code || '未执行'}`);
    if (step.output) {
      lines.push(`    输出: ${step.output}`);
    }

    // Pending steps
    const pending = plan.steps.filter(s => s.status === 'pending');
    if (pending.length > 0) {
      lines.push('');
      lines.push(`  待执行: ${pending.map(s => s.name).join(', ')}`);
    }

    lines.push(divider);

    // Output to stderr (visible to user, not to pipeline)
    process.stderr.write(lines.join('\n') + '\n');

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
