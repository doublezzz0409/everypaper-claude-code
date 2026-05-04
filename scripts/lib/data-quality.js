#!/usr/bin/env node
/**
 * Input Data Quality Check Module
 *
 * Shared logic for verifying data quality before calculation:
 * - Empty file detection
 * - UTF-8 encoding issues
 * - Null/missing value rate
 * - Value range checks
 * - Duplicate row detection
 * - All-NA column detection
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Check if a file is empty or missing
 * @param {string} filePath - Path to file
 * @returns {object} { ok, error }
 */
function checkEmptyFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `文件不存在: ${path.basename(filePath)}` };
  }
  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return { ok: false, error: `文件为空: ${path.basename(filePath)}` };
  }
  return { ok: true, error: null };
}

/**
 * Check for encoding issues in a text file
 * @param {string} filePath - Path to file
 * @returns {object} { ok, issues }
 */
function checkEncoding(filePath) {
  const issues = [];
  try {
    const buf = fs.readFileSync(filePath);
    // Check for null bytes (binary content in text file)
    for (let i = 0; i < Math.min(buf.length, 10000); i++) {
      if (buf[i] === 0) {
        issues.push({ level: 'critical', message: '文件包含二进制内容（空字节），可能编码错误' });
        return { ok: false, issues };
      }
    }
    // Check for BOM
    if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      issues.push({ level: 'info', message: '文件包含 UTF-8 BOM，可能影响列名解析' });
    }
    // Try to decode as UTF-8
    const text = buf.toString('utf8');
    if (text.includes('�')) {
      issues.push({ level: 'critical', message: '文件包含无效 UTF-8 字符（替换字符 U+FFFD）' });
    }
    return { ok: issues.filter(i => i.level === 'critical').length === 0, issues };
  } catch {
    return { ok: false, issues: [{ level: 'critical', message: '无法读取文件' }] };
  }
}

/**
 * Parse CSV header and return column names
 * @param {string} filePath - Path to CSV file
 * @returns {Array<string>|null} Column names or null on error
 */
function parseCsvHeader(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const firstLine = content.split('\n')[0];
    if (!firstLine) return null;
    return firstLine.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  } catch {
    return null;
  }
}

/**
 * Count rows in a CSV file (excluding header)
 * @param {string} filePath - Path to CSV file
 * @returns {number} Row count, -1 on error
 */
function countRows(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    return Math.max(0, lines.length - 1);
  } catch {
    return -1;
  }
}

/**
 * Check null rate for a specific column
 * @param {string} filePath - Path to CSV file
 * @param {string} columnName - Column name
 * @param {number} threshold - Null rate threshold (0-1, default 0.5)
 * @returns {object} { ok, total, nullCount, nullPct }
 */
function checkNullRate(filePath, columnName, threshold) {
  threshold = threshold || 0.5;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { ok: true, total: 0, nullCount: 0, nullPct: 0 };

    const header = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const colIdx = header.indexOf(columnName);
    if (colIdx === -1) return { ok: true, total: 0, nullCount: 0, nullPct: 0 };

    const total = lines.length - 1;
    let nullCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const val = (cols[colIdx] || '').trim();
      if (val === '' || val === 'NA' || val === 'NaN' || val === 'null' || val === '.') {
        nullCount++;
      }
    }

    const nullPct = total > 0 ? nullCount / total : 0;
    return { ok: nullPct < threshold, total, nullCount, nullPct };
  } catch {
    return { ok: true, total: 0, nullCount: 0, nullPct: 0 };
  }
}

/**
 * Check if a column is entirely NA/empty
 * @param {string} filePath - Path to CSV file
 * @param {string} columnName - Column name
 * @returns {boolean} true if all values are NA/empty
 */
function isAllNA(filePath, columnName) {
  const result = checkNullRate(filePath, columnName, 1.0);
  return result.total > 0 && result.nullPct === 1.0;
}

/**
 * Detect all-NA columns in a CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {Array<string>} Column names that are entirely NA
 */
function detectAllNAColumns(filePath) {
  const columns = parseCsvHeader(filePath);
  if (!columns) return [];
  return columns.filter(col => isAllNA(filePath, col));
}

/**
 * Check value range for a numeric column
 * @param {string} filePath - Path to CSV file
 * @param {string} columnName - Column name
 * @param {number} min - Minimum allowed value (inclusive)
 * @param {number} max - Maximum allowed value (inclusive)
 * @returns {object} { ok, violations, total }
 */
function checkValueRange(filePath, columnName, min, max) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { ok: true, violations: 0, total: 0 };

    const header = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const colIdx = header.indexOf(columnName);
    if (colIdx === -1) return { ok: true, violations: 0, total: 0 };

    const total = lines.length - 1;
    let violations = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const val = (cols[colIdx] || '').trim();
      if (val === '' || val === 'NA' || val === 'NaN' || val === 'null') continue;
      const num = parseFloat(val);
      if (isNaN(num)) continue;
      if (num < min || num > max) violations++;
    }

    return { ok: violations === 0, violations, total };
  } catch {
    return { ok: true, violations: 0, total: 0 };
  }
}

/**
 * Detect duplicate rows in a CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {object} { ok, duplicateCount, total }
 */
function detectDuplicateRows(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { ok: true, duplicateCount: 0, total: 0 };

    const total = lines.length - 1;
    const seen = new Set();
    let duplicateCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (seen.has(line)) {
        duplicateCount++;
      } else {
        seen.add(line);
      }
    }

    return { ok: duplicateCount === 0, duplicateCount, total };
  } catch {
    return { ok: true, duplicateCount: 0, total: 0 };
  }
}

/**
 * Run a comprehensive quality check on a data file
 * @param {string} filePath - Path to data file
 * @param {object} options - Check options
 * @param {number} options.nullThreshold - Null rate threshold (default 0.5)
 * @param {Array<string>} options.checkColumns - Columns to check null rate
 * @param {Array<{column, min, max}>} options.rangeChecks - Value range checks
 * @returns {object} { ok, issues: [{level, message}], summary }
 */
function runQualityCheck(filePath, options) {
  options = options || {};
  const issues = [];
  const summary = {};

  // 1. Empty file check
  const emptyCheck = checkEmptyFile(filePath);
  if (!emptyCheck.ok) {
    issues.push({ level: 'critical', message: emptyCheck.error });
    return { ok: false, issues, summary };
  }

  // 2. Encoding check
  const encCheck = checkEncoding(filePath);
  if (!encCheck.ok) {
    issues.push(...encCheck.issues.filter(i => i.level === 'critical'));
  }

  // 3. Row count
  const rowCount = countRows(filePath);
  summary.rows = rowCount;
  if (rowCount === 0) {
    issues.push({ level: 'critical', message: '文件只有表头，无数据行' });
    return { ok: false, issues, summary };
  }

  // 4. All-NA columns
  const allNACols = detectAllNAColumns(filePath);
  if (allNACols.length > 0) {
    for (const col of allNACols) {
      issues.push({ level: 'warning', message: `列 "${col}" 全部为空值` });
    }
  }

  // 5. Null rate check for key columns
  if (options.checkColumns) {
    const threshold = options.nullThreshold || 0.5;
    for (const col of options.checkColumns) {
      const nullCheck = checkNullRate(filePath, col, threshold);
      if (!nullCheck.ok) {
        issues.push({
          level: 'warning',
          message: `列 "${col}" 缺失率 ${(nullCheck.nullPct * 100).toFixed(1)}% (${nullCheck.nullCount}/${nullCheck.total})，超过 ${(threshold * 100).toFixed(0)}% 阈值`,
        });
      }
    }
  }

  // 6. Value range checks
  if (options.rangeChecks) {
    for (const rc of options.rangeChecks) {
      const rangeResult = checkValueRange(filePath, rc.column, rc.min, rc.max);
      if (!rangeResult.ok) {
        issues.push({
          level: 'warning',
          message: `列 "${rc.column}" 有 ${rangeResult.violations}/${rangeResult.total} 个值超出范围 [${rc.min}, ${rc.max}]`,
        });
      }
    }
  }

  // 7. Duplicate rows
  const dupCheck = detectDuplicateRows(filePath);
  if (!dupCheck.ok) {
    const dupPct = dupCheck.total > 0 ? (dupCheck.duplicateCount / dupCheck.total * 100).toFixed(1) : 0;
    issues.push({
      level: dupCheck.duplicateCount / dupCheck.total > 0.1 ? 'warning' : 'info',
      message: `发现 ${dupCheck.duplicateCount} 行重复数据 (${dupPct}%)`,
    });
  }

  summary.totalIssues = issues.length;
  summary.critical = issues.filter(i => i.level === 'critical').length;
  summary.warnings = issues.filter(i => i.level === 'warning').length;

  const hasCritical = issues.some(i => i.level === 'critical');
  return { ok: !hasCritical, issues, summary };
}

/**
 * Format quality issues for stderr output
 * @param {string} fileName - File name
 * @param {Array} issues - Array of { level, message }
 * @returns {string} Formatted message
 */
function formatQualityIssues(fileName, issues) {
  if (issues.length === 0) return '';
  const lines = [`[Quality] ${fileName} 数据质量检查:`];
  for (const issue of issues) {
    const icon = issue.level === 'critical' ? '❌' : issue.level === 'warning' ? '⚠️' : 'ℹ️';
    lines.push(`  ${icon} ${issue.message}`);
  }
  return lines.join('\n');
}

module.exports = {
  checkEmptyFile,
  checkEncoding,
  parseCsvHeader,
  countRows,
  checkNullRate,
  isAllNA,
  detectAllNAColumns,
  checkValueRange,
  detectDuplicateRows,
  runQualityCheck,
  formatQualityIssues,
};
