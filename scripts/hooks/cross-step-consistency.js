#!/usr/bin/env node
/**
 * PostToolUse:Bash Hook — Cross-Step Consistency Check (Blocking)
 *
 * After each calculation step, verifies consistency between pipeline steps:
 * - Column name match between upstream output and downstream input
 * - Row count logical consistency
 * - Data flow completeness
 *
 * Returns:
 *   string = pass-through (no issues or non-calc command)
 *   { exitCode: 2, stderr: string } = block on critical inconsistency
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { getOutputDir, log } = require('../lib/utils');
const pipeline = require('../lib/pipeline');
const { CODE_PATTERNS } = require('./post-calc-save');
const { parseCsvHeader } = require('../lib/data-quality');

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const command = data.command || data.tool_input?.command || '';
    const exitCode = data.exit_code || data.result?.exit_code || 0;

    // Only check calculation commands
    let isCalc = false;
    for (const pat of CODE_PATTERNS) {
      if (pat.regex.test(command)) {
        isCalc = true;
        break;
      }
    }
    if (!isCalc) return rawInput;

    // Only check on successful commands
    if (exitCode !== 0) return rawInput;

    // Load plan
    const plan = pipeline.loadPlan();
    if (!plan) return rawInput;

    const outputDir = getOutputDir();
    const issues = [];

    // Check each executed step's output against downstream expectations
    for (const step of plan.steps) {
      if (step.status !== 'executed' || !step.output) continue;

      const outputPath = path.join(outputDir, 'data', step.output);
      if (!fs.existsSync(outputPath)) continue;

      const outputHeader = parseCsvHeader(outputPath);
      if (!outputHeader) continue;

      // Find steps that depend on this step's output
      const downstreamSteps = plan.steps.filter(s =>
        s.dependsOn && s.dependsOn.includes(step.id)
      );

      for (const ds of downstreamSteps) {
        // Check if downstream step's input file matches this step's output
        if (ds.input === step.output) {
          // Same file — check if columns changed
          const dsPath = path.join(outputDir, 'data', ds.input);
          if (fs.existsSync(dsPath)) {
            const dsHeader = parseCsvHeader(dsPath);
            if (dsHeader) {
              const missingCols = outputHeader.filter(c => !dsHeader.includes(c));
              const extraCols = dsHeader.filter(c => !outputHeader.includes(c));

              if (missingCols.length > 0) {
                issues.push({
                  level: 'critical',
                  message: `${step.name} → ${ds.name}: 上游输出缺少下游期望的列: ${missingCols.join(', ')}`,
                });
              }
              if (extraCols.length > 0) {
                issues.push({
                  level: 'info',
                  message: `${step.name} → ${ds.name}: 上游输出有额外列: ${extraCols.join(', ')}`,
                });
              }
            }
          }
        }
      }

      // Check snapshot row count consistency
      if (step.snapshots && step.snapshots.length > 0) {
        const lastSnap = step.snapshots[step.snapshots.length - 1];
        if (lastSnap.rows !== null && lastSnap.rows !== undefined) {
          for (const ds of downstreamSteps) {
            if (ds.snapshots && ds.snapshots.length > 0) {
              const dsSnap = ds.snapshots[ds.snapshots.length - 1];
              if (dsSnap.rows !== null && dsSnap.rows > lastSnap.rows * 1.1) {
                issues.push({
                  level: 'warning',
                  message: `${ds.name} 行数 (${dsSnap.rows}) 超过上游 ${step.name} 行数 (${lastSnap.rows})，可能数据异常`,
                });
              }
            }
          }
        }
      }
    }

    // Report issues
    if (issues.length > 0) {
      const critical = issues.filter(i => i.level === 'critical');
      const warnings = issues.filter(i => i.level === 'warning');

      const lines = ['[Consistency] 跨步骤一致性检查:'];
      for (const issue of issues) {
        const icon = issue.level === 'critical' ? '❌' : issue.level === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`  ${icon} ${issue.message}`);
      }

      if (critical.length > 0) {
        lines.push('  🚫 上下游数据不一致，必须修复后才能继续。');
        log('Consistency', `BLOCKED: ${critical.length} critical consistency issues`);
        return { exitCode: 2, stderr: lines.join('\n') + '\n' };
      }

      if (warnings.length > 0) {
        process.stderr.write(lines.join('\n') + '\n');
      }
    }

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
    if (result && typeof result === 'object' && result.exitCode) {
      process.stderr.write(result.stderr || '');
      process.exit(result.exitCode);
    }
    process.stdout.write(result);
  });
}

module.exports = { run };
