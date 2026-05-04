#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const et = require('../../scripts/lib/env-tracker');

module.exports = function(ctx) {
  ctx.assert(typeof et.trackEnvironment === 'function', 'trackEnvironment exported');
  ctx.assert(typeof et.captureEnvironment === 'function', 'captureEnvironment exported');
  ctx.assert(typeof et.compareEnvironments === 'function', 'compareEnvironments exported');
  ctx.assert(typeof et.formatEnvChanges === 'function', 'formatEnvChanges exported');
  ctx.assert(typeof et.loadSnapshot === 'function', 'loadSnapshot exported');
  ctx.assert(typeof et.saveSnapshot === 'function', 'saveSnapshot exported');
  ctx.assert(typeof et.ENV_FILE === 'function', 'ENV_FILE exported');
  ctx.assert(et.CRITICAL_PACKAGES instanceof Set, 'CRITICAL_PACKAGES is Set');
  ctx.assert(et.CRITICAL_PACKAGES.has('numpy'), 'numpy is critical');
  ctx.assert(et.CRITICAL_PACKAGES.has('pandas'), 'pandas is critical');

  // compareEnvironments — no changes
  const prev = { pythonVersion: '3.11.0', packages: { numpy: '1.26.4', pandas: '2.2.1' } };
  const curr = { pythonVersion: '3.11.0', packages: { numpy: '1.26.4', pandas: '2.2.1' } };
  const diff1 = et.compareEnvironments(prev, curr);
  ctx.assertEqual(diff1.changed.length, 0, 'no changes');
  ctx.assert(!diff1.pythonChanged, 'python not changed');

  // compareEnvironments — package version change
  const curr2 = { pythonVersion: '3.11.0', packages: { numpy: '1.27.0', pandas: '2.2.1' } };
  const diff2 = et.compareEnvironments(prev, curr2);
  ctx.assertEqual(diff2.changed.length, 1, 'one change');
  ctx.assertEqual(diff2.changed[0].name, 'numpy', 'numpy changed');
  ctx.assert(diff2.changed[0].critical, 'numpy is critical');

  // compareEnvironments — python version change
  const curr3 = { pythonVersion: '3.12.0', packages: { numpy: '1.26.4', pandas: '2.2.1' } };
  const diff3 = et.compareEnvironments(prev, curr3);
  ctx.assert(diff3.pythonChanged, 'python changed');

  // compareEnvironments — new package installed
  const curr4 = { pythonVersion: '3.11.0', packages: { numpy: '1.26.4', pandas: '2.2.1', scipy: '1.12.0' } };
  const diff4 = et.compareEnvironments(prev, curr4);
  ctx.assertEqual(diff4.changed.length, 1, 'new package detected');
  ctx.assertEqual(diff4.changed[0].currVersion, '1.12.0', 'new version');

  // compareEnvironments — null inputs
  const diff5 = et.compareEnvironments(null, curr);
  ctx.assertEqual(diff5.changed.length, 0, 'null prev no changes');
  const diff6 = et.compareEnvironments(prev, null);
  ctx.assertEqual(diff6.changed.length, 0, 'null curr no changes');

  // formatEnvChanges — empty
  ctx.assertEqual(et.formatEnvChanges({ changes: [] }), '', 'empty changes empty string');

  // formatEnvChanges — critical change
  const fmt = et.formatEnvChanges({
    changes: [{ name: 'numpy', prevVersion: '1.26.4', currVersion: '1.27.0', critical: true }],
    pythonChanged: false,
  });
  ctx.assert(fmt.includes('EnvTracker'), 'has header');
  ctx.assert(fmt.includes('numpy'), 'mentions numpy');
  ctx.assert(fmt.includes('1.26.4'), 'has old version');
  ctx.assert(fmt.includes('1.27.0'), 'has new version');

  // formatEnvChanges — python changed
  const fmt2 = et.formatEnvChanges({
    changes: [],
    pythonChanged: true,
  });
  ctx.assert(fmt2.includes('Python'), 'mentions python');

  // trackEnvironment with invalid python → returns gracefully
  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-env-test-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'data'), { recursive: true });
  process.chdir(tmpDir);

  try {
    const result = et.trackEnvironment('nonexistent_python_cmd');
    ctx.assertEqual(result.snapshot, null, 'invalid python returns null snapshot');
    ctx.assertEqual(result.changes.length, 0, 'invalid python no changes');
    ctx.assert(!result.hasCriticalChange, 'invalid python no critical change');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
