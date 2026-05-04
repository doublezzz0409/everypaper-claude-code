#!/usr/bin/env node
/**
 * Pipeline Manifest — Research Data Flow Management
 *
 * Manages plan.json: records research steps, tracks source data versions,
 * saves result snapshots, and assesses impact when data changes.
 *
 * Design principle: snapshot-based comparison, not column-level prediction.
 * When data changes, re-run and compare to find exactly what's affected.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getOutputDir, ensureDir, readJson, writeJson, getTimestamp } = require('./utils');

const PLAN_FILE = () => path.join(getOutputDir(), 'data', 'plan.json');
const SNAPSHOTS_DIR = () => path.join(getOutputDir(), 'data', 'snapshots');

/**
 * Format timestamp as readable string: 2026-05-04 10:00
 */
function formatTime(isoString) {
  if (!isoString) return 'unknown';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Generate a version tag: original, v1, v2, v3...
 */
function nextVersionTag(existingVersions) {
  if (!existingVersions || existingVersions.length === 0) return 'original';
  const maxV = existingVersions.reduce((max, v) => {
    if (v.tag === 'original') return max;
    const num = parseInt(v.tag.replace('v', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `v${maxV + 1}`;
}

/**
 * Load plan.json, return null if not found
 */
function loadPlan() {
  return readJson(PLAN_FILE());
}

/**
 * Save plan.json
 */
function savePlan(plan) {
  ensureDir(path.dirname(PLAN_FILE()));
  writeJson(PLAN_FILE(), plan);
}

/**
 * Create a new research plan
 * @param {string} research - Research title/question
 * @param {Array} steps - Array of { name, input, method, output }
 * @returns {object} The created plan
 */
function createPlan(research, steps) {
  const now = getTimestamp();
  const plan = {
    research,
    created: now,
    status: 'active',
    sources: {},
    steps: steps.map((s, i) => ({
      id: `step_${String(i + 1).padStart(3, '0')}`,
      name: s.name,
      input: s.input,
      method: s.method,
      output: s.output,
      code: null,
      codeTime: null,
      snapshots: [],
      status: 'pending',
      dependsOn: s.dependsOn || [],
    })),
    history: [{ event: 'plan_created', timestamp: now, detail: research }],
  };
  savePlan(plan);
  return plan;
}

/**
 * Register a source data file and its initial version
 * @param {object} plan - The plan object
 * @param {string} sourceFile - Source file path (e.g., "annual_report.xlsx")
 * @param {string} note - Note about this version (e.g., "原始数据")
 * @returns {object} Updated plan
 */
function registerSource(plan, sourceFile, note) {
  const now = getTimestamp();
  if (!plan.sources[sourceFile]) {
    plan.sources[sourceFile] = { versions: [] };
  }
  const tag = nextVersionTag(plan.sources[sourceFile].versions);
  plan.sources[sourceFile].versions.push({
    tag,
    time: now,
    note: note || (tag === 'original' ? '原始数据' : '数据更新'),
  });
  plan.history.push({
    event: 'source_registered',
    timestamp: now,
    detail: `${sourceFile} ${tag}`,
  });
  savePlan(plan);
  return plan;
}

/**
 * Record a new version of source data (when file is modified)
 * @param {object} plan - The plan object
 * @param {string} sourceFile - Source file path
 * @param {string} note - Note about what changed
 * @returns {object} Updated plan
 */
function recordSourceChange(plan, sourceFile, note) {
  const now = getTimestamp();
  if (!plan.sources[sourceFile]) {
    plan.sources[sourceFile] = { versions: [] };
  }
  const tag = nextVersionTag(plan.sources[sourceFile].versions);
  plan.sources[sourceFile].versions.push({
    tag,
    time: now,
    note: note || '数据修改',
  });
  plan.history.push({
    event: 'source_changed',
    timestamp: now,
    detail: `${sourceFile} → ${tag}: ${note || '数据修改'}`,
  });
  savePlan(plan);
  return plan;
}

/**
 * Update a step with its code file after execution
 * @param {object} plan - The plan object
 * @param {string} stepId - Step ID (e.g., "step_001")
 * @param {string} codeFile - Code file name (e.g., "calc_001.py")
 * @returns {object} Updated plan
 */
function updateStepCode(plan, stepId, codeFile) {
  const now = getTimestamp();
  const step = plan.steps.find(s => s.id === stepId);
  if (!step) return plan;
  step.code = codeFile;
  step.codeTime = now;
  step.status = 'executed';
  plan.history.push({
    event: 'step_executed',
    timestamp: now,
    detail: `${stepId} (${step.name}) → ${codeFile}`,
  });
  savePlan(plan);
  return plan;
}

/**
 * Save a result snapshot for a step
 * @param {object} plan - The plan object
 * @param {string} stepId - Step ID
 * @param {object} result - { rows, preview, metrics }
 * @returns {object} Updated plan
 */
function saveSnapshot(plan, stepId, result) {
  const now = getTimestamp();
  const step = plan.steps.find(s => s.id === stepId);
  if (!step) return plan;

  const sourceTag = getLatestSourceTag(plan);
  const snapshot = {
    tag: sourceTag,
    time: now,
    checksum: result.checksum || null,
    rows: result.rows || null,
    preview: result.preview || null,
    metrics: result.metrics || null,
    match: null,
  };
  step.snapshots.push(snapshot);
  step.status = 'executed';

  plan.history.push({
    event: 'snapshot_saved',
    timestamp: now,
    detail: `${stepId} (${step.name}) snapshot [${sourceTag}]: ${result.rows || '?'}行`,
  });
  savePlan(plan);
  return plan;
}

/**
 * Get the latest source version tag across all source files
 */
function getLatestSourceTag(plan) {
  let latest = 'original';
  let latestTime = '';
  for (const [, src] of Object.entries(plan.sources)) {
    for (const v of src.versions) {
      if (v.time >= latestTime) {
        latestTime = v.time;
        latest = v.tag;
      }
    }
  }
  return latest;
}

/**
 * Mark a step as stale and cascade to dependents
 * @param {object} plan - The plan object
 * @param {string} stepId - Step ID to mark stale
 * @param {string} reason - Why it's stale
 * @returns {object} Updated plan
 */
function markStale(plan, stepId, reason) {
  const now = getTimestamp();
  const step = plan.steps.find(s => s.id === stepId);
  if (!step || step.status === 'stale') return plan;

  step.status = 'stale';
  step.staleReason = reason;
  step.staleAt = now;

  plan.history.push({
    event: 'step_invalidated',
    timestamp: now,
    detail: `${stepId} (${step.name}): ${reason}`,
  });

  // Cascade to dependents
  for (const dependent of plan.steps) {
    if (dependent.dependsOn.includes(stepId)) {
      markStale(plan, dependent.id, `上游步骤 ${stepId} 已过期`);
    }
  }

  plan.status = 'affected';
  savePlan(plan);
  return plan;
}

/**
 * Assess impact: find which steps depend on a changed source file
 * @param {object} plan - The plan object
 * @param {string} sourceFile - Changed source file
 * @returns {Array} List of affected step IDs
 */
function assessImpact(plan, sourceFile) {
  const affected = [];
  for (const step of plan.steps) {
    if (step.input && step.input.includes(sourceFile)) {
      affected.push(step.id);
    }
  }
  return affected;
}

/**
 * Get all stale steps
 * @param {object} plan - The plan object
 * @returns {Array} List of stale steps
 */
function getStaleSteps(plan) {
  return plan.steps.filter(s => s.status === 'stale');
}

/**
 * Find step by its code file name
 * @param {object} plan - The plan object
 * @param {string} codeFile - Code file name
 * @returns {object|null} Step or null
 */
function getStepByCode(plan, codeFile) {
  return plan.steps.find(s => s.code === codeFile) || null;
}

/**
 * Compute result snapshot: checksum + row count + first N lines
 * @param {string} filePath - Path to result file (CSV, etc.)
 * @param {number} previewLines - Number of lines for preview
 * @returns {object} { checksum, rows, preview }
 */
function computeResultSnapshot(filePath, previewLines = 5) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    const lines = content.split('\n').filter(l => l.trim());
    const rows = Math.max(0, lines.length - 1); // subtract header
    const preview = lines.slice(0, previewLines + 1).join('\n');
    return { checksum, rows, preview };
  } catch {
    return null;
  }
}

/**
 * Compare two snapshots: are they the same?
 * @param {object} snap1 - { checksum, rows }
 * @param {object} snap2 - { checksum, rows }
 * @returns {boolean} true if identical
 */
function snapshotsMatch(snap1, snap2) {
  if (!snap1 || !snap2) return false;
  return snap1.checksum === snap2.checksum;
}

/**
 * Generate a summary report of the current plan state
 * @param {object} plan - The plan object
 * @returns {string} Human-readable report
 */
function generateReport(plan) {
  if (!plan) return '无研究计划。';

  const lines = [];
  lines.push(`研究：${plan.research}`);
  lines.push(`创建：${formatTime(plan.created)}`);
  lines.push(`状态：${plan.status === 'affected' ? '⚠️ 有变更' : '✅ 正常'}`);
  lines.push('');

  // Source versions
  lines.push('─── 源数据版本 ───');
  for (const [file, src] of Object.entries(plan.sources)) {
    lines.push(`  ${file}`);
    for (const v of src.versions) {
      const marker = v === src.versions[src.versions.length - 1] ? '●' : '○';
      lines.push(`    ${marker} ${v.tag}  ${formatTime(v.time)}  ${v.note}`);
    }
  }
  lines.push('');

  // Steps
  lines.push('─── 执行步骤 ───');
  for (const step of plan.steps) {
    const statusIcon = step.status === 'stale' ? '❌' : step.status === 'executed' ? '✅' : '⏳';
    lines.push(`  ${statusIcon} ${step.id} ${step.name}`);
    if (step.code) lines.push(`     代码：${step.code}  ${formatTime(step.codeTime)}`);
    if (step.snapshots.length > 0) {
      const latest = step.snapshots[step.snapshots.length - 1];
      lines.push(`     最新快照：${latest.tag}  ${formatTime(latest.time)}  ${latest.rows || '?'}行`);
    }
    if (step.status === 'stale') {
      lines.push(`     ⚠️ 过期原因：${step.staleReason}`);
    }
  }

  // Stale summary
  const stale = getStaleSteps(plan);
  if (stale.length > 0) {
    lines.push('');
    lines.push('─── 影响评估 ───');
    lines.push(`  ${stale.length} 个步骤过期：${stale.map(s => s.name).join(', ')}`);
  }

  return lines.join('\n');
}

module.exports = {
  PLAN_FILE,
  SNAPSHOTS_DIR,
  formatTime,
  nextVersionTag,
  loadPlan,
  savePlan,
  createPlan,
  registerSource,
  recordSourceChange,
  updateStepCode,
  saveSnapshot,
  getLatestSourceTag,
  markStale,
  assessImpact,
  getStaleSteps,
  getStepByCode,
  computeResultSnapshot,
  snapshotsMatch,
  generateReport,
};
