#!/usr/bin/env node
/**
 * PostToolUse:Bash Hook — Audit Log
 *
 * Records all code execution for review.
 */

'use strict';

const { getAuditDir, ensureDir, appendFile, getTimestamp } = require('../lib/utils');

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const command = data.command || data.tool_input?.command || '';
    const output = data.output || data.result?.stdout || '';
    const exitCode = data.exit_code || data.result?.exit_code || 0;

    const logDir = ensureDir(getAuditDir());
    const logEntry = `[${getTimestamp()}] Command: ${command}\nExit Code: ${exitCode}\nOutput: ${output.substring(0, 500)}\n---\n`;

    appendFile(`${logDir}/bash-audit.log`, logEntry);

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
