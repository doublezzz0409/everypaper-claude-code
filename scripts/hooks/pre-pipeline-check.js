#!/usr/bin/env node
/**
 * PreToolUse:Bash Hook — Pipeline Step Check (Blocking)
 *
 * Before Python/R code execution, checks if there are stale pipeline steps.
 * Blocks execution (exit 2) if upstream steps are outdated.
 *
 * Returns:
 *   string = pass-through (no stale steps or non-calc command)
 *   { exitCode: 2, stderr: string } = block execution
 */

'use strict';

const { log } = require('../lib/utils');
const { loadPlan, getStaleSteps } = require('../lib/pipeline');
const { CODE_PATTERNS } = require('./post-calc-save');

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const command = data.command || data.tool_input?.command || '';

    // Only check for calculation commands
    let isCalc = false;
    for (const pat of CODE_PATTERNS) {
      if (pat.regex.test(command)) {
        isCalc = true;
        break;
      }
    }
    if (!isCalc) return rawInput;

    // Load plan and check for stale steps
    const plan = loadPlan();
    if (!plan) return rawInput;

    const stale = getStaleSteps(plan);
    if (stale.length === 0) return rawInput;

    const lines = [];
    lines.push(`[Pipeline] ❌ 检测到 ${stale.length} 个过期步骤，阻止执行：`);
    for (const step of stale) {
      lines.push(`  ❌ ${step.id} ${step.name}: ${step.staleReason || '上游数据已变更'}`);
    }
    lines.push('  🚫 必须先重跑过期步骤才能继续。');
    lines.push('  提示: 重跑过期步骤后，再执行当前命令。');

    log('Pipeline', `BLOCKED: ${stale.length} stale steps`);

    return { exitCode: 2, stderr: lines.join('\n') + '\n' };
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
