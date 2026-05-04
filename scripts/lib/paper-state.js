#!/usr/bin/env node
/**
 * Paper State Management
 *
 * Tracks paper writing progress across sessions:
 * - References in papers/references.json
 * - Audit logs in output/audit/
 * - Pending confirmations
 * - Current paper section being written
 */

'use strict';

const fs = require('fs');
const path = require('path');

const STATE_DIR = 'output/sessions';
const STATE_FILE = 'paper-state.json';

function getStatePath() {
  return path.join(process.cwd(), STATE_DIR, STATE_FILE);
}

function ensureDir() {
  const dir = path.join(process.cwd(), STATE_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadState() {
  const statePath = getStatePath();
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch {
      // corrupted state, return default
    }
  }
  return {
    lastUpdated: null,
    currentSection: null,
    references: [],
    pendingConfirmations: [],
    completedSections: [],
    auditLog: []
  };
}

function saveState(state) {
  ensureDir();
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2));
}

function scanReferences() {
  const refsPath = path.join(process.cwd(), 'papers', 'references.json');
  if (fs.existsSync(refsPath)) {
    try {
      return JSON.parse(fs.readFileSync(refsPath, 'utf8'));
    } catch {
      return [];
    }
  }
  return [];
}

function scanAuditLog() {
  const auditPath = path.join(process.cwd(), 'output', 'audit', 'bash-audit.log');
  if (fs.existsSync(auditPath)) {
    try {
      const content = fs.readFileSync(auditPath, 'utf8');
      return content.split('\n---\n').filter(Boolean).length;
    } catch {
      return 0;
    }
  }
  return 0;
}

function buildProgressSummary(state) {
  const refs = scanReferences();
  const auditCount = scanAuditLog();
  const pending = state.pendingConfirmations || [];

  let summary = '## Paper Progress\n\n';
  summary += `- Last updated: ${state.lastUpdated || 'never'}\n`;
  summary += `- Current section: ${state.currentSection || 'not set'}\n`;
  summary += `- References: ${refs.length} entries\n`;
  summary += `- Audit entries: ${auditCount}\n`;
  summary += `- Completed sections: ${(state.completedSections || []).join(', ') || 'none'}\n`;

  if (pending.length > 0) {
    summary += '\n### Pending Confirmations\n';
    pending.forEach(p => {
      summary += `- [ ] ${p}\n`;
    });
  }

  return summary;
}

module.exports = {
  loadState,
  saveState,
  scanReferences,
  scanAuditLog,
  buildProgressSummary
};
