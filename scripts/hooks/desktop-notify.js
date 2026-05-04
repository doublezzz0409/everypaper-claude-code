#!/usr/bin/env node
/**
 * Desktop Notification Hook (Stop)
 *
 * Sends a native desktop notification when a paper writing session ends.
 * Supports: macOS (osascript), WSL (PowerShell BurntToast), Linux (notify-send)
 */

'use strict';

const { spawnSync } = require('child_process');
const { isMacOS, isLinux, log } = require('../lib/utils');

const TITLE = 'EveryPaper';
const MAX_BODY_LENGTH = 100;

let isWSL = false;
if (isLinux) {
  try {
    isWSL = require('fs').readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch {
    isWSL = false;
  }
}

function findPowerShell() {
  if (!isWSL) return null;
  const candidates = [
    'pwsh.exe',
    'powershell.exe',
    '/mnt/c/Program Files/PowerShell/7/pwsh.exe',
    '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
  ];
  for (const p of candidates) {
    try {
      const result = spawnSync(p, ['-Command', 'exit 0'],
        { stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 });
      if (result.status === 0) return p;
    } catch {
      // continue
    }
  }
  return null;
}

function notifyWindows(pwshPath, title, body) {
  const safeBody = body.replace(/'/g, "''");
  const safeTitle = title.replace(/'/g, "''");
  const command = `Import-Module BurntToast; New-BurntToastNotification -Text '${safeTitle}', '${safeBody}'`;
  const result = spawnSync(pwshPath, ['-Command', command],
    { stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 });
  if (result.status === 0) return { success: true, reason: null };
  const errorMsg = result.error ? result.error.message : result.stderr?.toString();
  return { success: false, reason: errorMsg || `exit ${result.status}` };
}

function notifyMacOS(title, body) {
  const safeBody = body.replace(/\\/g, '').replace(/"/g, '“');
  const safeTitle = title.replace(/\\/g, '').replace(/"/g, '“');
  const script = `display notification "${safeBody}" with title "${safeTitle}"`;
  const result = spawnSync('osascript', ['-e', script], { stdio: 'ignore', timeout: 5000 });
  if (result.error || result.status !== 0) {
    log('DesktopNotify', `osascript failed: ${result.error ? result.error.message : `exit ${result.status}`}`);
  }
}

function notifyLinux(title, body) {
  const result = spawnSync('notify-send', [title, body],
    { stdio: 'ignore', timeout: 5000 });
  if (result.error || result.status !== 0) {
    log('DesktopNotify', `notify-send failed: ${result.error ? result.error.message : `exit ${result.status}`}`);
  }
}

function extractSummary(message) {
  if (!message || typeof message !== 'string') return 'Session complete';

  const firstLine = message
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 0);

  if (!firstLine) return 'Session complete';

  return firstLine.length > MAX_BODY_LENGTH
    ? `${firstLine.slice(0, MAX_BODY_LENGTH)}...`
    : firstLine;
}

function run(raw) {
  try {
    const input = raw.trim() ? JSON.parse(raw) : {};
    const summary = extractSummary(input.last_assistant_message);

    if (isMacOS) {
      notifyMacOS(TITLE, summary);
    } else if (isWSL) {
      const ps = findPowerShell();
      if (ps) {
        const { success, reason } = notifyWindows(ps, TITLE, summary);
        if (!success && reason && reason.toLowerCase().includes('burnttoast')) {
          log('DesktopNotify', 'Tip: Install BurntToast module for notifications');
        }
      }
    } else if (isLinux) {
      notifyLinux(TITLE, summary);
    }
  } catch (err) {
    log('DesktopNotify', `Error: ${err.message}`);
  }

  return raw;
}

module.exports = { run };

if (require.main === module) {
  const MAX_STDIN = 1024 * 1024;
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (data.length < MAX_STDIN) data += chunk;
  });
  process.stdin.on('end', () => {
    const output = run(data);
    if (output) process.stdout.write(output);
  });
}
