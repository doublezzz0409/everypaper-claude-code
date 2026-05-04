#!/usr/bin/env node
/**
 * Business Rules Engine
 *
 * Configurable rules for domain-specific data validation:
 * - Financial data rules (audit fees > 0, year ranges)
 * - Academic data rules (sample size, variable naming)
 * - Custom user-defined rules loaded from business-rules.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getOutputDir, log } = require('./utils');

const RULES_FILE = () => path.join(getOutputDir(), 'data', 'business-rules.json');

/**
 * Default business rules for common research scenarios
 */
const DEFAULT_RULES = [
  {
    id: 'audit_fee_positive',
    name: '审计费用为正',
    description: 'audit_fee 列的值必须大于 0',
    column: 'audit_fee',
    type: 'range',
    min: 0,
    max: null,
    severity: 'critical',
    enabled: true,
  },
  {
    id: 'year_valid',
    name: '年份合理',
    description: 'year 列的值必须在 1990-2030 之间',
    column: 'year',
    type: 'range',
    min: 1990,
    max: 2030,
    severity: 'critical',
    enabled: true,
  },
  {
    id: 'firm_id_not_null',
    name: '公司ID非空',
    description: 'firm_id 列不能为空',
    column: 'firm_id',
    type: 'not_null',
    threshold: 0.01,
    severity: 'critical',
    enabled: true,
  },
  {
    id: 'sample_size_adequate',
    name: '样本量充足',
    description: '数据集至少100行',
    type: 'min_rows',
    minRows: 100,
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'no_fully_null_column',
    name: '无全空列',
    description: '不应存在全部为空值的列',
    type: 'no_all_null',
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'id_unique',
    name: 'ID唯一性',
    description: 'ID列不应有重复值',
    column: null,
    type: 'unique',
    columnPatterns: ['id', 'firm_id', 'company_id', 'stock_code'],
    severity: 'critical',
    enabled: true,
  },
];

/**
 * Load custom rules from business-rules.json, merged with defaults
 * @returns {Array} Merged rules
 */
function loadRules() {
  let custom = [];
  try {
    if (fs.existsSync(RULES_FILE())) {
      custom = JSON.parse(fs.readFileSync(RULES_FILE(), 'utf8'));
    }
  } catch {
    // ignore parse errors
  }

  const merged = new Map();
  for (const rule of DEFAULT_RULES) {
    merged.set(rule.id, { ...rule });
  }
  for (const rule of custom) {
    merged.set(rule.id, { ...rule });
  }

  return Array.from(merged.values()).filter(r => r.enabled !== false);
}

/**
 * Save rules to business-rules.json
 * @param {Array} rules - Rules to save
 */
function saveRules(rules) {
  const file = RULES_FILE();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, JSON.stringify(rules, null, 2), 'utf8');
}

/**
 * Parse CSV content into header + rows
 * @param {string} filePath - Path to CSV file
 * @returns {object|null} { header: string[], rows: string[][] } or null
 */
function parseCsv(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 1) return null;
    const header = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(l => l.split(','));
    return { header, rows };
  } catch {
    return null;
  }
}

/**
 * Check a single rule against data
 * @param {object} rule - Rule definition
 * @param {string} filePath - Path to data file
 * @returns {object|null} { level, message } or null if passed
 */
function checkRule(rule, filePath) {
  const csv = parseCsv(filePath);
  if (!csv) return null;

  const fileName = path.basename(filePath);

  switch (rule.type) {
    case 'range': {
      const colIdx = csv.header.indexOf(rule.column);
      if (colIdx === -1) return null;
      let violations = 0;
      for (const row of csv.rows) {
        const val = parseFloat(row[colIdx]);
        if (isNaN(val)) continue;
        if (rule.min !== null && val < rule.min) violations++;
        if (rule.max !== null && val > rule.max) violations++;
      }
      if (violations > 0) {
        const rangeStr = `[${rule.min !== null ? rule.min : '-∞'}, ${rule.max !== null ? rule.max : '+∞'}]`;
        return {
          level: rule.severity || 'warning',
          message: `${fileName}: ${rule.name} — 列 "${rule.column}" 有 ${violations} 个值超出范围 ${rangeStr}`,
        };
      }
      return null;
    }

    case 'not_null': {
      const colIdx = csv.header.indexOf(rule.column);
      if (colIdx === -1) return null;
      let nullCount = 0;
      for (const row of csv.rows) {
        const val = (row[colIdx] || '').trim();
        if (val === '' || val === 'NA' || val === 'NaN' || val === 'null' || val === '.') {
          nullCount++;
        }
      }
      const threshold = rule.threshold || 0.01;
      const nullPct = csv.rows.length > 0 ? nullCount / csv.rows.length : 0;
      if (nullPct > threshold) {
        return {
          level: rule.severity || 'warning',
          message: `${fileName}: ${rule.name} — 列 "${rule.column}" 缺失率 ${(nullPct * 100).toFixed(1)}% (${nullCount}/${csv.rows.length})`,
        };
      }
      return null;
    }

    case 'min_rows': {
      if (csv.rows.length < rule.minRows) {
        return {
          level: rule.severity || 'warning',
          message: `${fileName}: ${rule.name} — 数据仅 ${csv.rows.length} 行，要求至少 ${rule.minRows} 行`,
        };
      }
      return null;
    }

    case 'no_all_null': {
      const allNullCols = [];
      for (let c = 0; c < csv.header.length; c++) {
        const allNull = csv.rows.every(row => {
          const val = (row[c] || '').trim();
          return val === '' || val === 'NA' || val === 'NaN' || val === 'null';
        });
        if (allNull && csv.rows.length > 0) {
          allNullCols.push(csv.header[c]);
        }
      }
      if (allNullCols.length > 0) {
        return {
          level: rule.severity || 'warning',
          message: `${fileName}: ${rule.name} — 以下列全部为空值: ${allNullCols.join(', ')}`,
        };
      }
      return null;
    }

    case 'unique': {
      const patterns = rule.columnPatterns || [rule.column];
      for (const pattern of patterns) {
        const colIdx = csv.header.findIndex(h => h.toLowerCase() === pattern.toLowerCase());
        if (colIdx === -1) continue;
        const seen = new Set();
        let dupCount = 0;
        for (const row of csv.rows) {
          const val = (row[colIdx] || '').trim();
          if (val === '' || val === 'NA') continue;
          if (seen.has(val)) dupCount++;
          else seen.add(val);
        }
        if (dupCount > 0) {
          return {
            level: rule.severity || 'warning',
            message: `${fileName}: ${rule.name} — 列 "${csv.header[colIdx]}" 有 ${dupCount} 个重复ID`,
          };
        }
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Run all applicable rules against a data file
 * @param {string} filePath - Path to data file
 * @param {Array} rules - Optional rules array (loads defaults if not provided)
 * @returns {object} { ok, issues: [{level, message}] }
 */
function runBusinessRules(filePath, rules) {
  if (!rules) rules = loadRules();
  const issues = [];

  for (const rule of rules) {
    const issue = checkRule(rule, filePath);
    if (issue) issues.push(issue);
  }

  const hasCritical = issues.some(i => i.level === 'critical');
  return { ok: !hasCritical, issues };
}

/**
 * Format business rule issues for stderr
 * @param {Array} issues - Array of { level, message }
 * @returns {string} Formatted message
 */
function formatRuleIssues(issues) {
  if (issues.length === 0) return '';
  const lines = ['[BusinessRules] 业务规则检查:'];
  for (const issue of issues) {
    const icon = issue.level === 'critical' ? '❌' : issue.level === 'warning' ? '⚠️' : 'ℹ️';
    lines.push(`  ${icon} ${issue.message}`);
  }
  return lines.join('\n');
}

module.exports = {
  DEFAULT_RULES,
  loadRules,
  saveRules,
  parseCsv,
  checkRule,
  runBusinessRules,
  formatRuleIssues,
};
