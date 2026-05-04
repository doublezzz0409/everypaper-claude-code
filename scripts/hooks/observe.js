#!/usr/bin/env node
/**
 * Observe Hook — Async Tool Usage Monitoring
 *
 * Captures all tool calls for pattern detection:
 * - Detects data file operations (CSV, Excel, Stata)
 * - Detects literature-related operations
 * - Logs tool usage patterns
 *
 * This hook runs async and never blocks tool execution.
 */

'use strict';

const { getAuditDir, ensureDir, appendFile, getTimestamp } = require('../lib/utils');

const MAX_STDIN = 1024 * 1024;

function detectDataFiles(input) {
  const warnings = [];

  const command = input.tool_input?.command || '';
  if (/\.(csv|xlsx?|dta|sav|sas|parquet|feather)/i.test(command)) {
    warnings.push(`[Observe] Data file operation detected: ${command.substring(0, 100)}`);
  }

  const filePath = input.tool_input?.file_path || '';
  if (/\.(csv|xlsx?|dta|sav|sas|parquet|feather)/i.test(filePath)) {
    warnings.push(`[Observe] Data file write detected: ${filePath}`);
  }

  return warnings;
}

function detectLiteratureOps(input) {
  const warnings = [];

  const content = input.tool_input?.content || '';
  const filePath = input.tool_input?.file_path || '';

  if (filePath.includes('papers/') || filePath.includes('references')) {
    warnings.push(`[Observe] Literature file operation: ${filePath}`);
  }

  const citationPattern = /\([A-Z][a-z]+(?:\s+et\s+al\.?)?,\s*\d{4}\)/g;
  const citations = content.match(citationPattern);
  if (citations && citations.length > 0) {
    warnings.push(`[Observe] Citations detected in content: ${citations.length} references`);
  }

  return warnings;
}

function run(rawInput) {
  try {
    const input = JSON.parse(rawInput);
    const toolName = input.tool_name || 'unknown';
    const timestamp = new Date().toISOString();

    const warnings = [
      ...detectDataFiles(input),
      ...detectLiteratureOps(input)
    ];

    const logDir = ensureDir(getAuditDir());
    const logEntry = `[${getTimestamp()}] Tool: ${toolName}${warnings.length > 0 ? ' | Warnings: ' + warnings.length : ''}\n`;
    appendFile(`${logDir}/observe.log`, logEntry);

    if (warnings.length > 0) {
      process.stderr.write(warnings.join('\n') + '\n');
    }

    return rawInput;
  } catch {
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
