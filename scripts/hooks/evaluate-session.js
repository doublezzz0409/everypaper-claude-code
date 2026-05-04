#!/usr/bin/env node
/**
 * Session Evaluator Hook (Stop)
 *
 * Evaluates paper writing session quality at session end.
 * Counts user messages and signals when a quality review is warranted.
 */

'use strict';

const fs = require('fs');
const { readFile, log } = require('../lib/utils');

const MAX_STDIN = 1024 * 1024;
const MIN_SESSION_LENGTH = 8;

function countPatternInFile(filePath, pattern) {
  const content = readFile(filePath);
  if (content === null) return 0;
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function run(raw) {
  try {
    const input = raw.trim() ? JSON.parse(raw) : {};
    const transcriptPath = input.transcript_path;

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      return raw;
    }

    const messageCount = countPatternInFile(transcriptPath, /"type"\s*:\s*"user"/g);

    if (messageCount < MIN_SESSION_LENGTH) {
      return raw;
    }

    log('EvaluateSession', `Session has ${messageCount} messages — evaluate for paper quality`);

    const content = readFile(transcriptPath) || '';
    const sectionWrites = (content.match(/output\/sections\//g) || []).length;
    const citationOps = (content.match(/references\.json|\.bib/g) || []).length;
    const dataOps = (content.match(/\.(csv|xlsx?|dta|sav)/g) || []).length;

    if (sectionWrites > 0) {
      log('EvaluateSession', `Sections written: ${sectionWrites} — check completeness`);
    }
    if (citationOps > 0) {
      log('EvaluateSession', `Citation operations: ${citationOps} — verify references`);
    }
    if (dataOps > 0) {
      log('EvaluateSession', `Data operations: ${dataOps} — verify reproducibility`);
    }
  } catch {
    // Keep hook non-blocking
  }

  return raw;
}

module.exports = { run };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) raw += chunk;
  });
  process.stdin.on('end', () => {
    const result = run(raw);
    if (result) process.stdout.write(result);
  });
}
