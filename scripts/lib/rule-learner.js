#!/usr/bin/env node
/**
 * Self-Evolving Rule Learner
 *
 * Learns data patterns from observations and generates validation rules:
 * - Column type inference (id, amount, temporal, ratio, category, text)
 * - Data distribution profiling (min, max, mean, stdDev, nullRate)
 * - Rule generation from profiles
 * - Rule state machine: observe → confirmed → active
 * - Threshold auto-adaptation from actual data
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getOutputDir, log } = require('./utils');

const PROFILES_FILE = () => path.join(getOutputDir(), 'data', 'data-profiles.json');
const LEARNED_RULES_FILE = () => path.join(getOutputDir(), 'data', 'learned-rules.json');

// Column type inference patterns
const COLUMN_TYPE_PATTERNS = [
  { type: 'id', patterns: [/_?id$/i, /^id$/i, /code$/i, /_?no$/i], unique: true },
  { type: 'temporal', patterns: [/year$/i, /date$/i, /time$/i, /month$/i, /quarter$/i, /^yr/i] },
  { type: 'amount', patterns: [/fee$/i, /cost$/i, /amount$/i, /price$/i, /revenue/i, /income/i, /expense/i, /profit/i, /salary/i, /wage/i, /asset/i, /debt/i, /capital/i] },
  { type: 'ratio', patterns: [/rate$/i, /ratio$/i, /pct$/i, /percent/i, /roe$/i, /roa$/i, /_?growth/i, /leverage/i] },
  { type: 'category', patterns: [/type$/i, /category/i, /class/i, /group/i, /level/i, /grade/i, /status$/i, /flag$/i, /dummy$/i, /indicator/i] },
];

function loadJson(filePath, defaultVal) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch { /* ignore */ }
  return defaultVal || {};
}

function saveJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function parseCsvWithStats(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;

    const header = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const rows = lines.length - 1;
    const stats = {};

    for (let c = 0; c < header.length; c++) {
      const colName = header[c];
      const values = [];
      let nullCount = 0;

      for (let r = 1; r < lines.length; r++) {
        const cols = lines[r].split(',');
        const val = (cols[c] || '').trim();
        if (val === '' || val === 'NA' || val === 'NaN' || val === 'null' || val === '.') {
          nullCount++;
        } else {
          const num = parseFloat(val);
          if (!isNaN(num)) values.push(num);
        }
      }

      stats[colName] = {
        totalRows: rows,
        numericCount: values.length,
        nullCount,
        nullRate: rows > 0 ? nullCount / rows : 0,
        allNumeric: values.length === rows - nullCount && values.length > 0,
      };

      if (values.length > 0) {
        values.sort((a, b) => a - b);
        stats[colName].min = values[0];
        stats[colName].max = values[values.length - 1];
        stats[colName].mean = values.reduce((s, v) => s + v, 0) / values.length;
        const variance = values.reduce((s, v) => s + Math.pow(v - stats[colName].mean, 2), 0) / values.length;
        stats[colName].stdDev = Math.sqrt(variance);

        const uniqueVals = new Set(values.map(String));
        stats[colName].uniqueCount = uniqueVals.size;
        stats[colName].allUnique = uniqueVals.size === values.length;
      }
    }

    return { header, rows, stats };
  } catch {
    return null;
  }
}

function inferColumnType(columnName, colStats) {
  for (const { patterns } of COLUMN_TYPE_PATTERNS) {
    for (const pat of patterns) {
      if (pat.test(columnName)) {
        // Determine which type matched
        const matched = COLUMN_TYPE_PATTERNS.find(p => p.patterns.includes(pat));
        if (matched) return matched.type;
      }
    }
  }

  if (colStats.allUnique && colStats.allNumeric) return 'id';
  if (colStats.allNumeric) {
    if (colStats.min >= 0 && colStats.max <= 1) return 'ratio';
    if (colStats.max - colStats.min < 20 && colStats.max === Math.floor(colStats.max)) return 'category';
    if (colStats.min >= 0 && colStats.max <= 100 && colStats.stdDev < 30) return 'ratio';
    return 'continuous';
  }

  return 'text';
}

function generateRulesFromProfile(fileName, profile) {
  const rules = [];

  for (const [colName, colInfo] of Object.entries(profile.columns || {})) {
    const { type, stats } = colInfo;

    switch (type) {
      case 'id':
        rules.push({
          id: `learned_${fileName}_${colName}_unique`,
          name: `${colName} 唯一性（自动学习）`,
          column: colName, type: 'unique', columnPatterns: [colName],
          severity: 'critical', source: 'learned', state: 'observe',
          triggerCount: 0, createdAt: new Date().toISOString(),
        });
        break;

      case 'amount':
        if (stats.min !== undefined) {
          rules.push({
            id: `learned_${fileName}_${colName}_positive`,
            name: `${colName} 为正数（自动学习）`,
            column: colName, type: 'range', min: 0, max: null,
            severity: 'critical', source: 'learned', state: 'observe',
            triggerCount: 0, createdAt: new Date().toISOString(),
          });
        }
        break;

      case 'temporal':
        if (stats.min !== undefined && stats.max !== undefined) {
          rules.push({
            id: `learned_${fileName}_${colName}_range`,
            name: `${colName} 范围 [${Math.floor(stats.min)}, ${Math.ceil(stats.max)}]（自动学习）`,
            column: colName, type: 'range',
            min: Math.floor(stats.min), max: Math.ceil(stats.max),
            severity: 'critical', source: 'learned', state: 'observe',
            triggerCount: 0, createdAt: new Date().toISOString(),
          });
        }
        break;

      case 'ratio':
        if (stats.min !== undefined) {
          const upper = stats.max <= 1 ? 1 : 100;
          rules.push({
            id: `learned_${fileName}_${colName}_range`,
            name: `${colName} 范围 [0, ${upper}]（自动学习）`,
            column: colName, type: 'range', min: 0, max: upper,
            severity: 'warning', source: 'learned', state: 'observe',
            triggerCount: 0, createdAt: new Date().toISOString(),
          });
        }
        break;

      case 'continuous':
        if (stats.mean !== undefined && stats.stdDev > 0) {
          rules.push({
            id: `learned_${fileName}_${colName}_outlier`,
            name: `${colName} 异常值检测（自动学习）`,
            column: colName, type: 'range',
            min: Math.floor(stats.mean - 5 * stats.stdDev),
            max: Math.ceil(stats.mean + 5 * stats.stdDev),
            severity: 'warning', source: 'learned', state: 'observe',
            triggerCount: 0, createdAt: new Date().toISOString(),
          });
        }
        break;
    }

    if (stats.nullRate !== undefined && stats.nullRate < 0.01) {
      rules.push({
        id: `learned_${fileName}_${colName}_notnull`,
        name: `${colName} 非空（自动学习）`,
        column: colName, type: 'not_null', threshold: 0.05,
        severity: 'warning', source: 'learned', state: 'observe',
        triggerCount: 0, createdAt: new Date().toISOString(),
      });
    }
  }

  return rules;
}

function profileData(filePath) {
  const parsed = parseCsvWithStats(filePath);
  if (!parsed) return null;

  const fileName = path.basename(filePath);
  const columns = {};
  for (const colName of parsed.header) {
    const stats = parsed.stats[colName] || {};
    const type = inferColumnType(colName, stats);
    columns[colName] = { type, stats };
  }

  return { fileName, rows: parsed.rows, columns, lastSeen: new Date().toISOString() };
}

function learnFromExecution(filePath) {
  const fileName = path.basename(filePath);
  const profile = profileData(filePath);
  if (!profile) return { profile: null, newRules: [], evolvedRules: [] };

  const profiles = loadJson(PROFILES_FILE(), {});
  const learnedRules = loadJson(LEARNED_RULES_FILE(), { rules: [] });

  profiles[fileName] = profile;
  saveJson(PROFILES_FILE(), profiles);

  const newRules = generateRulesFromProfile(fileName, profile);
  const evolvedRules = [];
  const existingIds = new Set(learnedRules.rules.map(r => r.id));

  for (const newRule of newRules) {
    const existing = learnedRules.rules.find(r => r.id === newRule.id);

    if (existing) {
      existing.triggerCount = (existing.triggerCount || 0) + 1;
      existing.lastSeen = new Date().toISOString();

      if (existing.state === 'observe' && existing.triggerCount >= 2) {
        existing.state = 'confirmed';
        existing.confirmedAt = new Date().toISOString();
        evolvedRules.push(existing);
      }
      if (existing.state === 'confirmed' && existing.triggerCount >= 3) {
        existing.state = 'active';
        existing.activatedAt = new Date().toISOString();
        evolvedRules.push(existing);
      }

      // Adaptive threshold
      if (existing.type === 'range' && existing.source === 'learned') {
        const colInfo = profile.columns[existing.column];
        if (colInfo && colInfo.stats) {
          if (colInfo.stats.min !== undefined && colInfo.stats.min < existing.min) {
            existing.min = Math.floor(colInfo.stats.min);
          }
          if (colInfo.stats.max !== undefined && colInfo.stats.max > existing.max) {
            existing.max = Math.ceil(colInfo.stats.max);
          }
        }
      }
    } else {
      learnedRules.rules.push(newRule);
    }
  }

  saveJson(LEARNED_RULES_FILE(), learnedRules);
  return { profile, newRules, evolvedRules };
}

function getActiveRules(filePath) {
  const fileName = path.basename(filePath);
  const learnedRules = loadJson(LEARNED_RULES_FILE(), { rules: [] });
  return learnedRules.rules.filter(r =>
    r.source === 'learned' && r.state !== 'observe' && r.id.includes(fileName)
  );
}

function getObserveRules(filePath) {
  const fileName = path.basename(filePath);
  const learnedRules = loadJson(LEARNED_RULES_FILE(), { rules: [] });
  return learnedRules.rules.filter(r =>
    r.source === 'learned' && r.state === 'observe' && r.id.includes(fileName)
  );
}

function formatLearnedRules(rules) {
  if (rules.length === 0) return '';
  const lines = ['[RuleLearner] 已学习规则:'];
  for (const rule of rules) {
    const stateIcon = rule.state === 'active' ? '✅' : rule.state === 'confirmed' ? '🔍' : '👁️';
    lines.push(`  ${stateIcon} [${rule.state}] ${rule.name} (触发${rule.triggerCount}次)`);
  }
  return lines.join('\n');
}

module.exports = {
  COLUMN_TYPE_PATTERNS,
  loadJson, saveJson, parseCsvWithStats,
  inferColumnType, generateRulesFromProfile,
  profileData, learnFromExecution,
  getActiveRules, getObserveRules, formatLearnedRules,
  PROFILES_FILE, LEARNED_RULES_FILE,
};
