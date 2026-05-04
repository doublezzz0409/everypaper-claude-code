#!/usr/bin/env node
/**
 * PreToolUse:Bash Hook — Input Data Quality Check (Blocking)
 *
 * Before Python/R code execution, checks input data files for quality issues:
 * - Empty or missing files
 * - UTF-8 encoding problems
 * - All-NA columns
 * - High null rates
 * - Business rule violations (audit_fee > 0, year range, etc.)
 *
 * Returns:
 *   string = pass-through (no issues or non-calc command)
 *   { exitCode: 2, stderr: string } = block execution
 */

'use strict';

const path = require('path');
const { getOutputDir, log } = require('../lib/utils');
const { extractDataRefs, CODE_PATTERNS } = require('./post-calc-save');
const quality = require('../lib/data-quality');
const businessRules = require('../lib/business-rules');

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

    // Extract data references from command
    const dataRefs = extractDataRefs('', command);
    if (dataRefs.length === 0) return rawInput;

    const allIssues = [];

    for (const ref of dataRefs) {
      const absPath = path.resolve(ref);

      // 1. Basic quality check
      const qualityResult = quality.runQualityCheck(absPath, {
        nullThreshold: 0.5,
      });
      if (!qualityResult.ok) {
        allIssues.push(...qualityResult.issues.filter(i => i.level === 'critical'));
      }

      // 2. Business rules check
      const rulesResult = businessRules.runBusinessRules(absPath);
      if (!rulesResult.ok) {
        allIssues.push(...rulesResult.issues.filter(i => i.level === 'critical'));
      }

      // 3. Learned rules check
      let learnedResult = { ok: true, issues: [] };
      try {
        const ruleLearner = require('../lib/rule-learner');
        const activeRules = ruleLearner.getActiveRules(absPath);
        if (activeRules.length > 0) {
          learnedResult = businessRules.runBusinessRules(absPath, activeRules);
          if (!learnedResult.ok) {
            allIssues.push(...learnedResult.issues.filter(i => i.level === 'critical'));
          }
        }
      } catch {
        // Rule learner is best-effort
      }

      // 4. Warnings (non-blocking)
      const warnings = [
        ...qualityResult.issues.filter(i => i.level === 'warning'),
        ...rulesResult.issues.filter(i => i.level === 'warning'),
        ...learnedResult.issues.filter(i => i.level === 'warning'),
      ];
      if (warnings.length > 0) {
        const msg = quality.formatQualityIssues(path.basename(ref), warnings);
        process.stderr.write(msg + '\n');
      }
    }

    // Block on critical issues
    if (allIssues.length > 0) {
      const lines = ['[Quality] ❌ 输入数据质量检查未通过:'];
      for (const issue of allIssues) {
        lines.push(`  ❌ ${issue.message}`);
      }
      lines.push('  🚫 必须修复数据质量问题后才能继续计算。');
      lines.push('  提示: 检查数据文件的完整性、编码和取值范围。');

      log('Quality', `BLOCKED: ${allIssues.length} critical data quality issues`);

      return { exitCode: 2, stderr: lines.join('\n') + '\n' };
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
