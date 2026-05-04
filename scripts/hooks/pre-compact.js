#!/usr/bin/env node
/**
 * PreCompact Hook — Save Paper State Before Context Compaction
 *
 * When Claude Code's context window approaches its limit, it compacts
 * the conversation. This hook saves the current paper state so that
 * the next session can resume where we left off.
 */

'use strict';

const { loadState, saveState, buildProgressSummary } = require('../lib/paper-state');

function run(rawInput) {
  try {
    const state = loadState();

    let toolName = '';
    try {
      const data = JSON.parse(rawInput);
      toolName = data.tool_name || '';
    } catch {
      // ignore parse errors
    }

    if (!state.auditLog) state.auditLog = [];
    state.auditLog.push({
      event: 'pre-compact',
      timestamp: new Date().toISOString(),
      tool: toolName
    });

    if (state.auditLog.length > 50) {
      state.auditLog = state.auditLog.slice(-50);
    }

    saveState(state);

    process.stderr.write(`[PreCompact] Paper state saved. References: ${(state.references || []).length}, Pending: ${(state.pendingConfirmations || []).length}\n`);

    return buildProgressSummary(state);
  } catch (err) {
    process.stderr.write(`[PreCompact] Error: ${err.message}\n`);
    return rawInput;
  }
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    const result = run(raw);
    process.stdout.write(result);
  });
}

module.exports = { run };
