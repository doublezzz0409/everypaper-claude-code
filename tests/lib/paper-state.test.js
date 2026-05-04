#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

module.exports = function(ctx) {
  const ps = require('../../scripts/lib/paper-state');

  const origCwd = process.cwd();
  const tmpDir = path.join(os.tmpdir(), 'everypaper-state-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'output', 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'papers'), { recursive: true });
  process.chdir(tmpDir);

  try {
    // loadState returns default when no file exists
    const state = ps.loadState();
    ctx.assert(state.lastUpdated === null, 'default state lastUpdated is null');
    ctx.assert(state.currentSection === null, 'default state currentSection is null');
    ctx.assert(Array.isArray(state.references), 'default state has references array');
    ctx.assert(Array.isArray(state.completedSections), 'default state has completedSections array');
    ctx.assert(Array.isArray(state.auditLog), 'default state has auditLog array');

    // saveState + loadState roundtrip
    state.currentSection = 'introduction';
    state.completedSections = ['abstract'];
    ps.saveState(state);
    const loaded = ps.loadState();
    ctx.assertEqual(loaded.currentSection, 'introduction', 'saved state persists currentSection');
    ctx.assertDeepEqual(loaded.completedSections, ['abstract'], 'saved state persists completedSections');
    ctx.assert(loaded.lastUpdated !== null, 'saveState sets lastUpdated');

    // scanReferences returns empty when no file
    ctx.assert(Array.isArray(ps.scanReferences()), 'scanReferences returns array');
    ctx.assertEqual(ps.scanReferences().length, 0, 'scanReferences empty when no file');

    // scanReferences with data
    fs.writeFileSync(path.join(tmpDir, 'papers', 'references.json'), JSON.stringify([{ id: '1', title: 'Test' }]));
    ctx.assertEqual(ps.scanReferences().length, 1, 'scanReferences finds saved refs');

    // scanAuditLog returns 0 when no file
    ctx.assertEqual(ps.scanAuditLog(), 0, 'scanAuditLog returns 0 when no file');

    // scanAuditLog with data
    fs.mkdirSync(path.join(tmpDir, 'output', 'audit'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'output', 'audit', 'bash-audit.log'), 'entry1\n---\nentry2\n---\nentry3\n---\n');
    ctx.assertEqual(ps.scanAuditLog(), 3, 'scanAuditLog counts entries');

    // buildProgressSummary
    const summary = ps.buildProgressSummary(loaded);
    ctx.assert(summary.includes('Paper Progress'), 'summary has header');
    ctx.assert(summary.includes('introduction'), 'summary shows current section');
    ctx.assert(summary.includes('abstract'), 'summary shows completed sections');

    // buildProgressSummary with pending confirmations
    loaded.pendingConfirmations = ['Confirm methodology', 'Review results'];
    const summary2 = ps.buildProgressSummary(loaded);
    ctx.assert(summary2.includes('Pending Confirmations'), 'summary shows pending section');
    ctx.assert(summary2.includes('Confirm methodology'), 'summary lists confirmations');

    // loadState handles corrupted file
    fs.writeFileSync(path.join(tmpDir, 'output', 'sessions', 'paper-state.json'), 'not-json!!!');
    const fallback = ps.loadState();
    ctx.assert(fallback.lastUpdated === null, 'corrupted state returns default');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
