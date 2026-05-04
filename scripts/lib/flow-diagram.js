#!/usr/bin/env node
/**
 * Flow Diagram Generator
 *
 * Generates data flow diagrams from plan.json in two formats:
 * - Mermaid (for markdown rendering)
 * - ASCII (for terminal display)
 *
 * Shows: source files → steps → outputs, with version history and status.
 */

'use strict';

const path = require('path');
const { getOutputDir, ensureDir, writeFile } = require('./utils');
const pipeline = require('./pipeline');

const DIAGRAM_FILE = () => path.join(getOutputDir(), 'data', 'flow-diagram.md');

/**
 * Format timestamp short: 05-04 10:00
 */
function shortTime(isoString) {
  if (!isoString) return '??:??';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Status icon for step
 */
function stepIcon(status) {
  switch (status) {
    case 'executed': return '✅';
    case 'stale': return '❌';
    case 'pending': return '⏳';
    default: return '○';
  }
}

/**
 * Generate Mermaid diagram from plan
 * @param {object} plan - The plan object
 * @returns {string} Mermaid diagram code
 */
function generateMermaid(plan) {
  if (!plan || !plan.steps || plan.steps.length === 0) {
    return '```mermaid\ngraph TD\n    A[无研究计划]\n```';
  }

  const lines = ['```mermaid', 'graph TD'];

  // Source nodes
  const sourceFiles = Object.keys(plan.sources);
  for (const file of sourceFiles) {
    const safeId = file.replace(/[^a-zA-Z0-9]/g, '_');
    const versions = plan.sources[file].versions;
    const latest = versions[versions.length - 1];
    lines.push(`    ${safeId}["${file}<br/>${latest.tag} ${shortTime(latest.time)}"]`);
    lines.push(`    style ${safeId} fill:#e1f5fe`);
  }

  // Step nodes
  for (const step of plan.steps) {
    const statusColor = step.status === 'stale' ? '#ffcdd2' :
      step.status === 'executed' ? '#c8e6c9' : '#fff9c4';
    const snapInfo = step.snapshots.length > 0 ?
      `<br/>${step.snapshots[step.snapshots.length - 1].tag} ${shortTime(step.snapshots[step.snapshots.length - 1].time)} ${step.snapshots[step.snapshots.length - 1].rows || '?'}行` : '';
    lines.push(`    ${step.id}["${stepIcon(step.status)} ${step.name}<br/>${step.code || '未执行'}${snapInfo}"]`);
    lines.push(`    style ${step.id} fill:${statusColor}`);
  }

  // Edges: sources → steps
  for (const step of plan.steps) {
    for (const file of sourceFiles) {
      if (step.input && step.input.includes(file)) {
        const safeId = file.replace(/[^a-zA-Z0-9]/g, '_');
        lines.push(`    ${safeId} --> ${step.id}`);
      }
    }
  }

  // Edges: step dependencies
  for (const step of plan.steps) {
    for (const dep of step.dependsOn) {
      lines.push(`    ${dep} -.-> ${step.id}`);
    }
  }

  lines.push('```');
  return lines.join('\n');
}

/**
 * Generate ASCII diagram from plan
 * @param {object} plan - The plan object
 * @returns {string} ASCII diagram
 */
function generateAscii(plan) {
  if (!plan || !plan.steps || plan.steps.length === 0) {
    return '无研究计划。';
  }

  const lines = [];
  const divider = '─'.repeat(60);

  lines.push(`┌${divider}┐`);
  lines.push(`│  研究：${plan.research.padEnd(48)}│`);
  const statusText = plan.status === 'affected' ? '⚠️ 有变更' : '✅ 正常';
  lines.push(`│  状态：${statusText.padEnd(48)}│`);
  lines.push(`└${divider}┘`);
  lines.push('');

  // Source versions
  const sourceFiles = Object.keys(plan.sources);
  if (sourceFiles.length > 0) {
    lines.push('  源数据：');
    for (const file of sourceFiles) {
      const versions = plan.sources[file].versions;
      lines.push(`  ┌─ ${file}`);
      for (const v of versions) {
        const marker = v === versions[versions.length - 1] ? '●' : '○';
        lines.push(`  │  ${marker} ${v.tag.padEnd(10)} ${shortTime(v.time).padEnd(12)} ${v.note}`);
      }
      lines.push('  └─');
    }
    lines.push('');
  }

  // Steps with arrows
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const icon = stepIcon(step.status);

    lines.push(`  ${icon} Step ${i + 1}: ${step.name}`);
    if (step.code) {
      lines.push(`     代码: ${step.code}  ${shortTime(step.codeTime)}`);
    }
    if (step.input) {
      lines.push(`     输入: ${step.input}`);
    }
    if (step.output) {
      lines.push(`     输出: ${step.output}`);
    }

    // Snapshots
    if (step.snapshots.length > 0) {
      lines.push('     快照:');
      for (const snap of step.snapshots) {
        const matchIcon = snap.match === true ? '✅' : snap.match === false ? '❌' : '○';
        lines.push(`       ${matchIcon} ${snap.tag.padEnd(10)} ${shortTime(snap.time).padEnd(12)} ${snap.rows || '?'}行`);
      }
    }

    if (step.status === 'stale') {
      lines.push(`     ⚠️ 过期: ${step.staleReason}`);
    }

    // Arrow to next step
    if (i < plan.steps.length - 1) {
      lines.push('         │');
      lines.push('         ▼');
    }
  }

  // Impact summary
  const stale = pipeline.getStaleSteps(plan);
  if (stale.length > 0) {
    lines.push('');
    lines.push(`  ┌${'─'.repeat(56)}┐`);
    lines.push(`  │ 影响评估：${stale.length} 个步骤过期`.padEnd(58) + '│');
    for (const s of stale) {
      lines.push(`  │   ❌ ${s.name}: ${s.staleReason || '上游变更'}`.padEnd(58) + '│');
    }
    lines.push(`  └${'─'.repeat(56)}┘`);
  }

  return lines.join('\n');
}

/**
 * Generate and save flow diagram
 * @param {object} plan - The plan object (optional, loads from file if not provided)
 * @returns {object} { mermaid, ascii }
 */
function generateAndSave(plan) {
  if (!plan) plan = pipeline.loadPlan();
  if (!plan) return { mermaid: '', ascii: '无研究计划。' };

  const mermaid = generateMermaid(plan);
  const ascii = generateAscii(plan);

  const content = [
    `# 数据流图 — ${plan.research}`,
    '',
    `生成时间：${pipeline.formatTime(new Date().toISOString())}`,
    '',
    '## Mermaid',
    '',
    mermaid,
    '',
    '## ASCII',
    '',
    '```',
    ascii,
    '```',
  ].join('\n');

  ensureDir(path.dirname(DIAGRAM_FILE()));
  writeFile(DIAGRAM_FILE(), content);

  return { mermaid, ascii };
}

module.exports = {
  generateMermaid,
  generateAscii,
  generateAndSave,
  DIAGRAM_FILE,
};
