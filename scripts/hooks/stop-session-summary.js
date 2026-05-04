#!/usr/bin/env node
/**
 * Stop Hook — Session Summary
 *
 * Generates session summary and saves paper state.
 */

'use strict';

const { loadState, saveState, buildProgressSummary } = require('../lib/paper-state');
const { getSessionsDir, ensureDir, writeFile, getTimestamp } = require('../lib/utils');

function run(rawInput) {
  try {
    const state = loadState();

    // Update session end time
    if (!state.auditLog) state.auditLog = [];
    state.auditLog.push({
      event: 'session-end',
      timestamp: new Date().toISOString()
    });

    if (state.auditLog.length > 50) {
      state.auditLog = state.auditLog.slice(-50);
    }

    saveState(state);

    const summaryDir = ensureDir(getSessionsDir());
    const progress = buildProgressSummary(state);
    const summary = `# Session Summary\n\n## Time\n${getTimestamp()}\n\n${progress}\n\n## Next Steps\n- Review generated files\n- Confirm if continuation needed\n- Human review required before proceeding\n`;

    writeFile(`${summaryDir}/session-summary.md`, summary);

    process.stderr.write(`[Stop] Session summary saved to output/sessions/session-summary.md\n`);

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
