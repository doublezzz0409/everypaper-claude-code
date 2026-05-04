#!/usr/bin/env node
/**
 * Python Environment Tracker
 *
 * Captures Python package versions after calculation execution
 * and detects version changes that could affect reproducibility.
 *
 * Flow:
 *   1. After Python execution, capture package versions
 *   2. Save snapshot to output/data/env-snapshot.json
 *   3. Compare with previous snapshot
 *   4. Return changed packages (if any)
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getOutputDir, log } = require('./utils');

const ENV_FILE = () => path.join(getOutputDir(), 'data', 'env-snapshot.json');

// Packages that affect numerical computation results
const CRITICAL_PACKAGES = new Set([
  'numpy', 'pandas', 'scipy', 'statsmodels', 'scikit-learn',
  'matplotlib', 'seaborn', 'linearmodels', 'pyarrow',
  'openpyxl', 'xlrd', 'sqlalchemy', 'numba',
]);

function loadSnapshot() {
  try {
    if (fs.existsSync(ENV_FILE())) {
      return JSON.parse(fs.readFileSync(ENV_FILE(), 'utf8'));
    }
  } catch { /* ignore */ }
  return null;
}

function saveSnapshot(snapshot) {
  const dir = path.dirname(ENV_FILE());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(ENV_FILE(), JSON.stringify(snapshot, null, 2), 'utf8');
}

/**
 * Capture current Python package versions
 * @param {string} pythonCmd - Python command to use (default: 'python')
 * @returns {object|null} { packages: {name: version}, pythonVersion, timestamp }
 */
function captureEnvironment(pythonCmd) {
  try {
    const cmd = pythonCmd || 'python';
    const code = 'import json,sys;exec("try:\\n import pkg_resources\\n pkgs={p.project_name:p.version for p in pkg_resources.working_set}\\nexcept:\\n import importlib.metadata as m\\n pkgs={d.metadata[\'Name\']:d.version for d in m.distributions()}");print(json.dumps({"python":".".join(map(str,sys.version_info[:3])),"packages":pkgs}))';
    const result = execSync(`${cmd} -c "${code}"`, {
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(result.trim());
    return {
      pythonVersion: parsed.python,
      packages: parsed.packages,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Compare two environment snapshots
 * @param {object} prev - Previous snapshot
 * @param {object} curr - Current snapshot
 * @returns {{ changed: Array<{name, prevVersion, currVersion, critical}>, pythonChanged: boolean }}
 */
function compareEnvironments(prev, curr) {
  if (!prev || !curr) return { changed: [], pythonChanged: false };

  const changed = [];
  const allPackages = new Set([
    ...Object.keys(prev.packages || {}),
    ...Object.keys(curr.packages || {}),
  ]);

  for (const name of allPackages) {
    const prevVersion = (prev.packages || {})[name] || null;
    const currVersion = (curr.packages || {})[name] || null;

    if (prevVersion !== currVersion) {
      changed.push({
        name,
        prevVersion,
        currVersion,
        critical: CRITICAL_PACKAGES.has(name),
      });
    }
  }

  return {
    changed,
    pythonChanged: prev.pythonVersion !== curr.pythonVersion,
  };
}

/**
 * Capture and compare environment. Save if changed.
 * @param {string} pythonCmd - Python command
 * @returns {{ snapshot, changes, pythonChanged, hasCriticalChange }}
 */
function trackEnvironment(pythonCmd) {
  const curr = captureEnvironment(pythonCmd);
  if (!curr) return { snapshot: null, changes: [], pythonChanged: false, hasCriticalChange: false };

  const prev = loadSnapshot();
  const diff = compareEnvironments(prev, curr);

  saveSnapshot(curr);

  const criticalChanges = diff.changed.filter(c => c.critical);
  return {
    snapshot: curr,
    changes: diff.changed,
    pythonChanged: diff.pythonChanged,
    hasCriticalChange: criticalChanges.length > 0 || diff.pythonChanged,
  };
}

/**
 * Format environment changes for display
 * @param {object} result - From trackEnvironment()
 * @returns {string}
 */
function formatEnvChanges(result) {
  if ((!result.changes || result.changes.length === 0) && !result.pythonChanged) return '';

  const lines = ['[EnvTracker] Python 环境变更检测:'];

  if (result.pythonChanged) {
    lines.push('  ⚠️ Python 版本已变更');
  }

  const critical = result.changes.filter(c => c.critical);
  const nonCritical = result.changes.filter(c => !c.critical);

  if (critical.length > 0) {
    lines.push(`  ❌ ${critical.length} 个关键包版本变更（可能影响计算结果）:`);
    for (const c of critical) {
      lines.push(`    ${c.name}: ${c.prevVersion || '(未安装)'} → ${c.currVersion || '(已卸载)'}`);
    }
  }

  if (nonCritical.length > 0) {
    lines.push(`  ℹ️ ${nonCritical.length} 个非关键包变更`);
  }

  return lines.join('\n');
}

module.exports = {
  CRITICAL_PACKAGES,
  ENV_FILE,
  loadSnapshot, saveSnapshot,
  captureEnvironment, compareEnvironments,
  trackEnvironment, formatEnvChanges,
};
