#!/usr/bin/env node
/**
 * Config Protection Hook (PreToolUse)
 *
 * Blocks modifications to academic paper config/template files.
 * Prevents accidental corruption of bibliography, citation styles,
 * and paper templates.
 *
 * Exit codes:
 *   0 = allow (not a protected file)
 *   2 = block (protected file modification attempted)
 */

'use strict';

const path = require('path');

const MAX_STDIN = 1024 * 1024;

const PROTECTED_FILES = new Set([
  // Bibliography
  'references.bib',
  'references.json',
  'ref.bib',
  // Citation styles
  'apa.csl',
  'mla.csl',
  'chicago.csl',
  'ieee.csl',
  'harvard.csl',
  // Paper templates
  'template.tex',
  'template.md',
  'paper-template.md',
  // Project config
  'CLAUDE.md',
  'paper-config.yaml',
  'paper-config.yml',
  'paper-config.json',
  // LaTeX config
  '.latexmkrc',
  'latexmkrc',
]);

function parseInput(inputOrRaw) {
  if (typeof inputOrRaw === 'string') {
    try {
      return inputOrRaw.trim() ? JSON.parse(inputOrRaw) : {};
    } catch {
      return {};
    }
  }
  return inputOrRaw && typeof inputOrRaw === 'object' ? inputOrRaw : {};
}

function run(inputOrRaw, options = {}) {
  if (options.truncated) {
    return {
      exitCode: 2,
      stderr:
        '[ConfigProtection] BLOCKED: Hook input exceeded limit. ' +
        'Cannot verify file path on truncated payload.'
    };
  }

  const input = parseInput(inputOrRaw);
  const filePath = input?.tool_input?.file_path || input?.tool_input?.file || '';
  if (!filePath) return { exitCode: 0 };

  const basename = path.basename(filePath);
  if (PROTECTED_FILES.has(basename)) {
    return {
      exitCode: 2,
      stderr:
        `[ConfigProtection] BLOCKED: Modifying ${basename} is not allowed. ` +
        'This file is protected to prevent accidental corruption. ' +
        'If this is intentional, disable the config-protection hook temporarily.'
    };
  }

  return { exitCode: 0 };
}

module.exports = { run };

// Stdin fallback for spawnSync execution
let truncated = /^(1|true|yes)$/i.test(String(process.env.EVERYPAPER_HOOK_INPUT_TRUNCATED || ''));
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (raw.length < MAX_STDIN) {
    const remaining = MAX_STDIN - raw.length;
    raw += chunk.substring(0, remaining);
    if (chunk.length > remaining) truncated = true;
  } else {
    truncated = true;
  }
});

process.stdin.on('end', () => {
  const result = run(raw, {
    truncated,
    maxStdin: Number(process.env.EVERYPAPER_HOOK_INPUT_MAX_BYTES) || MAX_STDIN,
  });

  if (result.stderr) {
    process.stderr.write(result.stderr + '\n');
  }

  if (result.exitCode === 2) {
    process.exit(2);
  }

  process.stdout.write(raw);
});
