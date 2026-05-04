#!/usr/bin/env node
/**
 * Output Verification Module
 *
 * Shared logic for verifying calculation outputs:
 * - File existence and non-empty check
 * - Row count comparison with previous snapshot
 * - Column presence verification
 * - Null value detection
 * - Statistical sanity checks (p-values, R-squared, coefficients)
 * - Severity classification (critical/warning/info)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const pipeline = require('./pipeline');
const { log } = require('./utils');

/**
 * Verify that an output file exists and is non-empty
 * @param {string} filePath - Absolute path to output file
 * @returns {object} { ok, error }
 */
function verifyFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `输出文件不存在: ${path.basename(filePath)}` };
  }
  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return { ok: false, error: `输出文件为空: ${path.basename(filePath)}` };
  }
  return { ok: true, error: null };
}

/**
 * Compare current output with previous snapshot
 * @param {object} plan - The plan object
 * @param {string} stepId - Step ID
 * @param {object} currentSnap - Current result snapshot { rows, checksum }
 * @returns {object} { changed, rowDelta, prevRows, issues }
 */
function compareWithPrevious(plan, stepId, currentSnap) {
  const step = plan.steps.find(s => s.id === stepId);
  if (!step || step.snapshots.length === 0) {
    return { changed: false, rowDelta: 0, prevRows: null, issues: [] };
  }

  const prevSnap = step.snapshots[step.snapshots.length - 1];
  const issues = [];

  if (prevSnap.rows !== null && currentSnap.rows !== null) {
    const delta = currentSnap.rows - prevSnap.rows;
    const pctChange = prevSnap.rows > 0 ? Math.abs(delta / prevSnap.rows) : 0;

    if (pctChange > 0.5) {
      issues.push({
        level: 'critical',
        message: `行数变化过大: ${prevSnap.rows} → ${currentSnap.rows} (${delta > 0 ? '+' : ''}${delta}, ${(pctChange * 100).toFixed(1)}%)`,
      });
    } else if (pctChange > 0.1) {
      issues.push({
        level: 'warning',
        message: `行数变化较大: ${prevSnap.rows} → ${currentSnap.rows} (${delta > 0 ? '+' : ''}${delta}, ${(pctChange * 100).toFixed(1)}%)`,
      });
    }

    return {
      changed: prevSnap.checksum !== currentSnap.checksum,
      rowDelta: delta,
      prevRows: prevSnap.rows,
      issues,
    };
  }

  return { changed: false, rowDelta: 0, prevRows: prevSnap.rows, issues };
}

/**
 * Check CSV column names for expected columns
 * @param {string} filePath - Path to CSV file
 * @param {Array<string>} expectedColumns - Expected column names
 * @returns {object} { ok, missing, found }
 */
function verifyColumns(filePath, expectedColumns) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const header = content.split('\n')[0];
    if (!header) return { ok: false, missing: expectedColumns, found: [] };

    const actualColumns = header.split(',').map(c => c.trim().replace(/"/g, ''));
    const missing = expectedColumns.filter(c => !actualColumns.includes(c));

    return {
      ok: missing.length === 0,
      missing,
      found: actualColumns,
    };
  } catch {
    return { ok: false, missing: expectedColumns, found: [] };
  }
}

/**
 * Count null/empty values in a CSV column
 * @param {string} filePath - Path to CSV file
 * @param {string} columnName - Column to check
 * @returns {object} { total, nullCount, nullPct }
 */
function countNulls(filePath, columnName) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { total: 0, nullCount: 0, nullPct: 0 };

    const header = lines[0].split(',').map(c => c.trim().replace(/"/g, ''));
    const colIdx = header.indexOf(columnName);
    if (colIdx === -1) return { total: 0, nullCount: 0, nullPct: 0 };

    const total = lines.length - 1;
    let nullCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const val = (cols[colIdx] || '').trim();
      if (val === '' || val === 'NA' || val === 'NaN' || val === 'null') {
        nullCount++;
      }
    }

    return { total, nullCount, nullPct: total > 0 ? nullCount / total : 0 };
  } catch {
    return { total: 0, nullCount: 0, nullPct: 0 };
  }
}

/**
 * Statistical sanity checks for regression results
 * @param {object} stats - { coefficients: [{name, value, pValue}], rSquared, sampleSize }
 * @returns {Array<{level: string, message: string}>}
 */
function checkRegression(stats) {
  const issues = [];

  if (stats.coefficients) {
    for (const coef of stats.coefficients) {
      if (typeof coef.value === 'number' && Math.abs(coef.value) > 100) {
        issues.push({
          level: 'warning',
          message: `系数 ${coef.name} = ${coef.value} 异常大`,
        });
      }
      if (typeof coef.pValue === 'number') {
        if (coef.pValue < 0 || coef.pValue > 1) {
          issues.push({
            level: 'critical',
            message: `p值 ${coef.name} = ${coef.pValue} 超出 [0,1] 范围`,
          });
        }
      }
    }
  }

  if (typeof stats.rSquared === 'number') {
    if (stats.rSquared > 0.99) {
      issues.push({
        level: 'warning',
        message: `R² = ${stats.rSquared} 过高，可能过拟合或数据泄露`,
      });
    }
    if (stats.rSquared < 0) {
      issues.push({
        level: 'critical',
        message: `R² = ${stats.rSquared} 为负值，模型异常`,
      });
    }
  }

  if (typeof stats.sampleSize === 'number' && stats.sampleSize < 30) {
    issues.push({
      level: 'warning',
      message: `样本量 ${stats.sampleSize} 过小 (<30)，统计推断不可靠`,
    });
  }

  return issues;
}

/**
 * Statistical sanity checks for descriptive statistics
 * @param {object} stats - { variables: [{ name, mean, stdDev, min, max, count }] }
 * @param {number} totalRows - Total rows in dataset
 * @returns {Array<{level: string, message: string}>}
 */
function checkDescriptive(stats, totalRows) {
  const issues = [];

  if (!stats.variables) return issues;

  for (const v of stats.variables) {
    if (typeof v.stdDev === 'number' && v.stdDev === 0) {
      issues.push({
        level: 'warning',
        message: `${v.name} 标准差为 0，可能为常量列`,
      });
    }
    if (typeof v.count === 'number' && totalRows > 0 && v.count < totalRows * 0.5) {
      issues.push({
        level: 'warning',
        message: `${v.name} 有效值 ${v.count}/${totalRows}，缺失率 > 50%`,
      });
    }
    if (typeof v.min === 'number' && typeof v.max === 'number' && v.min > v.max) {
      issues.push({
        level: 'critical',
        message: `${v.name} 最小值 (${v.min}) > 最大值 (${v.max})`,
      });
    }
  }

  return issues;
}

/**
 * Format verification issues for stderr output
 * @param {string} stepName - Step name
 * @param {Array} issues - Array of { level, message }
 * @returns {string} Formatted message
 */
function formatIssues(stepName, issues) {
  if (issues.length === 0) return '';

  const lines = [`[Verify] ${stepName} 验证结果:`];
  for (const issue of issues) {
    const icon = issue.level === 'critical' ? '❌' : issue.level === 'warning' ? '⚠️' : 'ℹ️';
    lines.push(`  ${icon} ${issue.message}`);
  }
  return lines.join('\n');
}

/**
 * Determine the highest severity level from a list of issues
 * @param {Array} issues - Array of { level, message }
 * @returns {string} 'critical' | 'warning' | 'info' | 'ok'
 */
function highestSeverity(issues) {
  if (issues.some(i => i.level === 'critical')) return 'critical';
  if (issues.some(i => i.level === 'warning')) return 'warning';
  if (issues.some(i => i.level === 'info')) return 'info';
  return 'ok';
}

/**
 * Check reproducibility: same input should produce same output
 * @param {object} step - Pipeline step object
 * @param {object} currentSnap - Current output snapshot { checksum, rows }
 * @param {object} savedChecksums - Data checksums from _data-checksums.json
 * @returns {{ reproducible: boolean, issues: Array<{level, message}> }}
 */
function checkReproducibility(step, currentSnap, savedChecksums) {
  if (!step || !currentSnap || !step.snapshots || step.snapshots.length === 0) {
    return { reproducible: true, issues: [] };
  }

  const prevSnap = step.snapshots[step.snapshots.length - 1];
  if (!prevSnap.checksum) return { reproducible: true, issues: [] };

  // Output checksum is the same — definitely reproducible
  if (prevSnap.checksum === currentSnap.checksum) {
    return { reproducible: true, issues: [] };
  }

  // Output changed — check if input also changed
  // If input changed, output change is expected (not a reproducibility issue)
  // If input is the same but output changed — reproducibility problem
  const inputChanged = checkInputChanged(step, savedChecksums);

  if (!inputChanged) {
    return {
      reproducible: false,
      issues: [{
        level: 'warning',
        message: `结果不可复现: 输入未变但输出变化 (之前: ${prevSnap.checksum}, 现在: ${currentSnap.checksum})`,
      }],
    };
  }

  return { reproducible: true, issues: [] };
}

/**
 * Check if a step's input data has changed since its last snapshot
 * @param {object} step - Pipeline step
 * @param {object} savedChecksums - Data checksums
 * @returns {boolean} true if input changed
 */
function checkInputChanged(step, savedChecksums) {
  if (!step.input || !savedChecksums) return false;

  // The step's input file — check if its current checksum differs from saved
  const saved = savedChecksums[step.input];
  if (!saved) return true; // No saved checksum means input state unknown

  // If the step has a snapshot tagged with a source version,
  // and the saved checksum's lastSeen is after the snapshot time,
  // then the input changed after the snapshot was taken
  const latestSnap = step.snapshots[step.snapshots.length - 1];
  if (latestSnap && saved.lastSeen > latestSnap.time) {
    return true;
  }

  return false;
}

module.exports = {
  verifyFileExists,
  compareWithPrevious,
  verifyColumns,
  countNulls,
  checkRegression,
  checkDescriptive,
  formatIssues,
  highestSeverity,
  checkReproducibility,
  checkInputChanged,
};
