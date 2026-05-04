#!/usr/bin/env node
/**
 * PostToolUse:Bash Hook — Output Verification (Blocking)
 *
 * After Python/R code execution, verifies the output file:
 * - Checks output file exists and is non-empty
 * - Compares row count with previous snapshot
 * - Blocks (exit 2) on critical issues
 * - Warns (exit 0) on non-critical issues
 *
 * Returns:
 *   string = pass-through (no issues or non-calc command)
 *   { exitCode: 2, stderr: string } = block execution
 */

'use strict';

const path = require('path');
const { getOutputDir, log } = require('../lib/utils');
const pipeline = require('../lib/pipeline');
const verify = require('../lib/verify-output');
const { CODE_PATTERNS } = require('./post-calc-save');

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

    // Only verify if the command succeeded
    if (exitCode !== 0) return rawInput;

    // Load plan
    const plan = pipeline.loadPlan();
    if (!plan) return rawInput;

    // Find the most recently executed step
    const executedSteps = plan.steps.filter(s => s.status === 'executed' && s.output);
    if (executedSteps.length === 0) return rawInput;

    const lastStep = executedSteps[executedSteps.length - 1];
    const outputDir = getOutputDir();
    const outputPath = path.join(outputDir, 'data', lastStep.output);

    // 1. File existence check
    const existCheck = verify.verifyFileExists(outputPath);
    if (!existCheck.ok) {
      log('Verify', `BLOCKED: ${lastStep.output} not found after execution`);
      return {
        exitCode: 2,
        stderr: `[Verify] ❌ ${lastStep.name}: ${existCheck.error}\n`,
      };
    }

    // 2. Compute current snapshot
    const currentSnap = pipeline.computeResultSnapshot(outputPath);
    if (!currentSnap) return rawInput;

    // 3. Compare with previous snapshot
    const comparison = verify.compareWithPrevious(plan, lastStep.id, currentSnap);
    if (comparison.issues.length > 0) {
      const severity = verify.highestSeverity(comparison.issues);
      const msg = verify.formatIssues(lastStep.name, comparison.issues);

      if (severity === 'critical') {
        log('Verify', `BLOCKED: critical output issue for ${lastStep.name}`);
        return { exitCode: 2, stderr: msg + '\n' };
      }

      // Non-critical warnings: log but pass through
      if (severity === 'warning') {
        process.stderr.write(msg + '\n');
      }
    }

    if (comparison.changed) {
      log('Verify', `Output changed for ${lastStep.name}: ${comparison.prevRows} → ${currentSnap.rows} rows`);
    }

    // 4. Reproducibility check: same input → same output?
    const savedChecksums = (() => {
      try {
        const { loadDataChecksums } = require('./post-calc-save');
        return loadDataChecksums();
      } catch { return {}; }
    })();
    const reproCheck = verify.checkReproducibility(lastStep, currentSnap, savedChecksums);
    if (!reproCheck.reproducible && reproCheck.issues.length > 0) {
      const msg = verify.formatIssues(lastStep.name, reproCheck.issues);
      process.stderr.write(msg + '\n');
      log('Verify', `Reproducibility warning for ${lastStep.name}`);
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
