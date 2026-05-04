#!/usr/bin/env node
/**
 * PostToolUseFailure Hook — Handle Tool Failures
 *
 * Logs tool failures and provides recovery guidance.
 * Critical for paper writing: if a Python calculation fails,
 * the human needs to know immediately.
 */

'use strict';

const { getAuditDir, ensureDir, appendFile, getTimestamp } = require('../lib/utils');

const MAX_STDIN = 1024 * 1024;

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const toolName = data.tool_name || 'unknown';
    const error = data.error || 'unknown error';

    const auditDir = ensureDir(getAuditDir());
    const entry = `[${getTimestamp()}] Tool: ${toolName}\nError: ${error}\n---\n`;
    appendFile(`${auditDir}/tool-failures.log`, entry);

    const guidance = [];

    if (toolName === 'Bash') {
      const command = data.tool_input?.command || '';
      if (/python|pip|conda/.test(command)) {
        guidance.push('[PostToolUseFailure] Python execution failed. Check:');
        guidance.push('  1. Is Python installed? Run: python --version');
        guidance.push('  2. Are packages installed? Run: pip list');
        guidance.push('  3. Check the error output above for specific issues');
      } else if (/Rscript|R\b/.test(command)) {
        guidance.push('[PostToolUseFailure] R execution failed. Check:');
        guidance.push('  1. Is R installed? Run: R --version');
        guidance.push('  2. Are packages installed? Run: R -e "installed.packages()"');
      }
    }

    if (guidance.length > 0) {
      process.stderr.write(guidance.join('\n') + '\n');
    }

    return rawInput;
  } catch (err) {
    process.stderr.write(`[PostToolUseFailure] Error: ${err.message}\n`);
    return rawInput;
  }
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) raw += chunk;
  });
  process.stdin.on('end', () => {
    const result = run(raw);
    process.stdout.write(result);
  });
}

module.exports = { run };
