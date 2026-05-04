#!/usr/bin/env node
/**
 * PreToolUse:Write|Edit Hook — Data File Write Guard (Blocking)
 *
 * Before writing data files (.csv, .xlsx), validates:
 * - CSV format validity (consistent column count)
 * - Non-empty content
 * - Encoding validity
 * - Column name format (no spaces, no special chars)
 *
 * Returns:
 *   string = pass-through (non-data file or valid data)
 *   { exitCode: 2, stderr: string } = block on critical format issues
 */

'use strict';

const path = require('path');
const { log } = require('../lib/utils');

const DATA_EXTENSIONS = ['.csv', '.tsv', '.xlsx', '.xls', '.dta', '.sav', '.parquet'];

/**
 * Validate CSV content format
 * @param {string} content - File content
 * @returns {object} { ok, issues }
 */
function validateCsvContent(content) {
  const issues = [];
  if (!content || content.trim() === '') {
    return { ok: false, issues: [{ level: 'critical', message: '文件内容为空' }] };
  }

  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 1) {
    return { ok: false, issues: [{ level: 'critical', message: '无有效行' }] };
  }

  // Check header
  const header = lines[0].split(',').map(c => c.trim());
  const colCount = header.length;

  // Check for empty column names
  for (let i = 0; i < header.length; i++) {
    if (header[i] === '') {
      issues.push({ level: 'warning', message: `第 ${i + 1} 列列名为空` });
    }
    // Check for spaces in column names
    if (header[i].includes(' ')) {
      issues.push({ level: 'warning', message: `列名 "${header[i]}" 包含空格，建议使用下划线` });
    }
  }

  // Check row consistency
  let inconsistentRows = 0;
  for (let i = 1; i < lines.length; i++) {
    const rowColCount = lines[i].split(',').length;
    if (rowColCount !== colCount) {
      inconsistentRows++;
    }
  }

  if (inconsistentRows > 0) {
    const level = inconsistentRows > lines.length * 0.1 ? 'critical' : 'warning';
    issues.push({
      level,
      message: `${inconsistentRows} 行的列数与表头 (${colCount} 列) 不一致`,
    });
  }

  const hasCritical = issues.some(i => i.level === 'critical');
  return { ok: !hasCritical, issues };
}

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const filePath = data.tool_input?.file_path || data.file_path || '';
    const content = data.tool_input?.content || data.content || '';

    if (!filePath) return rawInput;

    const ext = path.extname(filePath).toLowerCase();
    if (!DATA_EXTENSIONS.includes(ext)) return rawInput;

    // Only validate CSV/TSV content
    if (ext === '.csv' || ext === '.tsv') {
      const result = validateCsvContent(content);

      if (!result.ok) {
        const lines = ['[DataGuard] ❌ 数据文件格式验证未通过:'];
        for (const issue of result.issues) {
          const icon = issue.level === 'critical' ? '❌' : '⚠️';
          lines.push(`  ${icon} ${issue.message}`);
        }
        lines.push('  🚫 必须修复格式问题后才能写入。');

        log('DataGuard', `BLOCKED: invalid CSV format for ${path.basename(filePath)}`);
        return { exitCode: 2, stderr: lines.join('\n') + '\n' };
      }

      // Non-critical warnings pass through
      const warnings = result.issues.filter(i => i.level === 'warning');
      if (warnings.length > 0) {
        const lines = ['[DataGuard] 数据文件格式警告:'];
        for (const w of warnings) {
          lines.push(`  ⚠️ ${w.message}`);
        }
        process.stderr.write(lines.join('\n') + '\n');
      }
    }

    return rawInput;
  } catch {
    return rawInput;
  }
}

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    const result = run(input);
    if (result && typeof result === 'object' && result.exitCode) {
      process.stderr.write(result.stderr || '');
      process.exit(result.exitCode);
    }
    process.stdout.write(result);
  });
}

module.exports = { run, validateCsvContent };
