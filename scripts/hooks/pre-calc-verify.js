#!/usr/bin/env node
/**
 * PreToolUse:Bash Hook — Data Checksum Verification (Blocking)
 *
 * Before Python/R code execution, checks:
 * 1. Source data files: have they changed since last calculation?
 * 2. Intermediate files: have upstream step outputs changed since their snapshot?
 *
 * Blocks execution (exit 2) if any data has been modified.
 *
 * Returns:
 *   string = pass-through (no mismatch or non-calc command)
 *   { exitCode: 2, stderr: string } = block execution
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { getOutputDir, log } = require('../lib/utils');
const pipeline = require('../lib/pipeline');
const {
  computeFileChecksum,
  loadDataChecksums,
  extractDataRefs,
  CODE_PATTERNS,
} = require('./post-calc-save');

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const command = data.command || data.tool_input?.command || '';

    // Check if this is a calculation command
    let isCalc = false;
    for (const pat of CODE_PATTERNS) {
      if (pat.regex.test(command)) {
        isCalc = true;
        break;
      }
    }
    if (!isCalc) return rawInput;

    // Extract data references from command
    const dataRefs = extractDataRefs('', command);
    if (dataRefs.length === 0) return rawInput;

    // Load saved checksums
    const savedChecksums = loadDataChecksums();
    const warnings = [];

    // === Layer 1: Source data file checksum ===
    for (const ref of dataRefs) {
      const currentChecksum = computeFileChecksum(ref);
      if (!currentChecksum) continue;

      const saved = savedChecksums[ref];
      if (!saved) {
        warnings.push(`[DataVerify] New data file detected: ${ref} (no previous checksum)`);
        continue;
      }

      if (currentChecksum !== saved.checksum) {
        warnings.push(
          `[DataVerify] WARNING: Source data file changed! ${ref}\n` +
          `  Previous checksum: ${saved.checksum} (from ${saved.lastSeen})\n` +
          `  Current checksum:  ${currentChecksum}\n` +
          `  Last used in: ${saved.script}\n` +
          `  The archived code may produce different results.`
        );
      }
    }

    // === Layer 2: Intermediate file checksum (upstream step outputs) ===
    const plan = pipeline.loadPlan();
    if (plan) {
      const outputDir = getOutputDir();
      const executedSteps = plan.steps.filter(s => s.status === 'executed' && s.output);

      for (const step of executedSteps) {
        const outputPath = path.join(outputDir, 'data', step.output);
        if (!fs.existsSync(outputPath)) continue;

        const currentSnap = pipeline.computeResultSnapshot(outputPath);
        if (!currentSnap) continue;

        // Find the latest snapshot for this step
        const latestSnap = step.snapshots && step.snapshots.length > 0
          ? step.snapshots[step.snapshots.length - 1]
          : null;

        if (latestSnap && latestSnap.preview) {
          // Compare checksums — the snapshot stores rows/preview but we need file checksum
          // Recompute from the snapshot's stored checksum if available
          const snapshotChecksum = latestSnap.checksum || null;
          if (snapshotChecksum && currentSnap.checksum !== snapshotChecksum) {
            const isReferenced = dataRefs.some(ref => {
              const absRef = path.resolve(ref);
              return absRef === outputPath || absRef === path.resolve(outputPath);
            });

            if (!isReferenced) {
              warnings.push(
                `[DataVerify] Intermediate file changed: ${step.output}\n` +
                `  Step: ${step.name} (${step.id})\n` +
                `  Previous snapshot: ${latestSnap.checksum} [${latestSnap.tag}]\n` +
                `  Current file:     ${currentSnap.checksum}\n` +
                `  This file may have been modified outside the pipeline.`
              );
            }
          }
        }
      }
    }

    if (warnings.length > 0) {
      const lines = [];
      lines.push('[DataVerify] BLOCKED: Data file checksum mismatch:');
      for (const w of warnings) {
        lines.push(w);
      }
      lines.push('  🚫 数据文件已变更，必须先重跑依赖该数据的步骤。');
      lines.push('  提示: 先重跑使用该数据的计算步骤，再继续。');

      log('DataVerify', 'BLOCKED: Data file checksum mismatch');

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
