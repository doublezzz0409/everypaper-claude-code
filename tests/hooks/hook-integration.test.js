#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const HOOKS_DIR = path.join(__dirname, '..', '..', 'scripts', 'hooks');

const HOOK_FILES = [
  'pre-bash-code-execution.js',
  'pre-calc-verify.js',
  'pre-pipeline-check.js',
  'pre-write-no-fabrication.js',
  'pre-write-citation-check.js',
  'pre-write-method-placeholder.js',
  'post-bash-audit.js',
  'post-calc-save.js',
  'post-calc-output-verify.js',
  'step-report.js',
  'post-write-quality-check.js',
  'stop-session-summary.js',
  'pipeline-report.js',
  'session-start.js',
  'pre-compact.js',
  'post-tool-failure.js',
  'observe.js',
  'config-protection.js',
  'cost-tracker.js',
  'evaluate-session.js',
  'desktop-notify.js',
  'pre-calc-quality.js',
  'post-calc-stderr.js',
  'cross-step-consistency.js',
  'pre-write-data-guard.js'
];

module.exports = function(ctx) {
  // Verify all hook files exist and export run()
  for (const file of HOOK_FILES) {
    const filePath = path.join(HOOKS_DIR, file);
    ctx.assert(fs.existsSync(filePath), `hook file exists: ${file}`);
    if (fs.existsSync(filePath)) {
      const mod = require(filePath);
      ctx.assert(typeof mod.run === 'function', `hook exports run(): ${file}`);
    }
  }

  // Test pre-write-no-fabrication with safe content
  const noFab = require(path.join(HOOKS_DIR, 'pre-write-no-fabrication.js'));
  const safeInput = JSON.stringify({ content: 'This is a simple paragraph with no citations.' });
  const safeResult = noFab.run(safeInput);
  ctx.assert(typeof safeResult === 'string', 'no-fabrication returns string for safe input');

  // Test pre-write-citation-check
  const citCheck = require(path.join(HOOKS_DIR, 'pre-write-citation-check.js'));
  const citInput = JSON.stringify({ tool_input: { content: 'Some text without citations.' } });
  const citResult = citCheck.run(citInput);
  ctx.assert(typeof citResult === 'string', 'citation-check returns string');

  // Test pre-write-method-placeholder
  const methodPH = require(path.join(HOOKS_DIR, 'pre-write-method-placeholder.js'));
  const methodInput = JSON.stringify({ tool_input: { content: 'We use OLS regression to estimate the model.' } });
  const methodResult = methodPH.run(methodInput);
  ctx.assert(typeof methodResult === 'string', 'method-placeholder returns string');

  // Test post-write-quality-check
  const qualCheck = require(path.join(HOOKS_DIR, 'post-write-quality-check.js'));
  const qualInput = JSON.stringify({ tool_input: { content: 'Short content.', file_path: '/tmp/test.md' } });
  const qualResult = qualCheck.run(qualInput);
  ctx.assert(typeof qualResult === 'string', 'quality-check returns string');

  // Test pre-compact
  const compact = require(path.join(HOOKS_DIR, 'pre-compact.js'));
  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-hook-test-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'sessions'), { recursive: true });
  process.chdir(tmpDir);
  try {
    const compactResult = compact.run('{}');
    ctx.assert(typeof compactResult === 'string', 'pre-compact returns string');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Test post-tool-failure
  const failHook = require(path.join(HOOKS_DIR, 'post-tool-failure.js'));
  const tmpDir2 = path.join(os.tmpdir(), 'everypaper-hook-fail-' + Date.now());
  fs.mkdirSync(path.join(tmpDir2, 'output', 'audit'), { recursive: true });
  process.chdir(tmpDir2);
  try {
    const failInput = JSON.stringify({ error: 'python: command not found', tool: 'Bash' });
    const failResult = failHook.run(failInput);
    ctx.assert(typeof failResult === 'string', 'post-tool-failure returns string');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir2, { recursive: true, force: true });
  }

  // Test pre-pipeline-check hook
  const pipelineCheck = require(path.join(HOOKS_DIR, 'pre-pipeline-check.js'));
  const tmpPipeline = path.join(os.tmpdir(), 'everypaper-hook-pipeline-' + Date.now());
  fs.mkdirSync(path.join(tmpPipeline, 'output', 'data'), { recursive: true });
  process.chdir(tmpPipeline);
  try {
    // Non-calc command passes through
    const nonCalcInput = JSON.stringify({ command: 'ls -la', tool_input: { command: 'ls -la' } });
    const nonCalcResult = pipelineCheck.run(nonCalcInput);
    ctx.assert(nonCalcResult === nonCalcInput, 'pre-pipeline-check passes non-calc through');

    // Calc command without plan passes through
    const calcInput = JSON.stringify({ command: 'python -c "print(1)"', tool_input: { command: 'python -c "print(1)"' } });
    const calcResult = pipelineCheck.run(calcInput);
    ctx.assert(calcResult === calcInput, 'pre-pipeline-check passes calc without plan');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpPipeline, { recursive: true, force: true });
  }

  // Test observe hook
  const observe = require(path.join(HOOKS_DIR, 'observe.js'));
  const tmpDir3 = path.join(os.tmpdir(), 'everypaper-hook-observe-' + Date.now());
  fs.mkdirSync(path.join(tmpDir3, 'output', 'audit'), { recursive: true });
  process.chdir(tmpDir3);
  try {
    const observeInput = JSON.stringify({ tool_input: { file_path: '/data/results.csv' } });
    const observeResult = observe.run(observeInput);
    ctx.assert(typeof observeResult === 'string', 'observe returns string');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir3, { recursive: true, force: true });
  }

  // Test config-protection hook
  const configProt = require(path.join(HOOKS_DIR, 'config-protection.js'));
  const safeFile = JSON.stringify({ tool_input: { file_path: '/tmp/normal-file.md' } });
  const protSafe = configProt.run(safeFile);
  ctx.assert(protSafe.exitCode === 0, 'config-protection allows normal files');

  const blockedFile = JSON.stringify({ tool_input: { file_path: '/project/references.bib' } });
  const protBlocked = configProt.run(blockedFile);
  ctx.assert(protBlocked.exitCode === 2, 'config-protection blocks references.bib');
  ctx.assert(protBlocked.stderr.includes('BLOCKED'), 'config-protection has blocked message');

  const claudMd = JSON.stringify({ tool_input: { file_path: '/project/CLAUDE.md' } });
  const protClaud = configProt.run(claudMd);
  ctx.assert(protClaud.exitCode === 2, 'config-protection blocks CLAUDE.md');

  ctx.assert(configProt.run('').exitCode === 0, 'config-protection empty input passes');
  ctx.assert(configProt.run('{}').exitCode === 0, 'config-protection no file_path passes');

  // Test cost-tracker hook
  const costTracker = require(path.join(HOOKS_DIR, 'cost-tracker.js'));
  const costInput = JSON.stringify({ usage: { input_tokens: 1000, output_tokens: 500 }, model: 'sonnet' });
  const costResult = costTracker.run(costInput);
  ctx.assert(typeof costResult === 'string', 'cost-tracker returns string');
  ctx.assert(costResult === costInput, 'cost-tracker passes stdin through');

  ctx.assert(costTracker.run('') === '', 'cost-tracker empty input passes');
  ctx.assert(costTracker.run('invalid') === 'invalid', 'cost-tracker invalid JSON passes');

  // Test evaluate-session hook
  const evalSession = require(path.join(HOOKS_DIR, 'evaluate-session.js'));
  const evalInput = JSON.stringify({ transcript_path: '/nonexistent/transcript.jsonl' });
  const evalResult = evalSession.run(evalInput);
  ctx.assert(typeof evalResult === 'string', 'evaluate-session returns string');

  ctx.assert(evalSession.run('') === '', 'evaluate-session empty input passes');

  // Test desktop-notify hook
  const desktopNotify = require(path.join(HOOKS_DIR, 'desktop-notify.js'));
  const notifyInput = JSON.stringify({ last_assistant_message: 'Paper draft complete.' });
  const notifyResult = desktopNotify.run(notifyInput);
  ctx.assert(typeof notifyResult === 'string', 'desktop-notify returns string');

  ctx.assert(desktopNotify.run('') === '', 'desktop-notify empty input passes');

  // Verify run-with-flags.js exists
  const runnerPath = path.join(HOOKS_DIR, 'run-with-flags.js');
  ctx.assert(fs.existsSync(runnerPath), 'run-with-flags.js exists');
};
