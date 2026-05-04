#!/usr/bin/env node
/**
 * PostToolUse:Bash Hook — Stderr Capture & Analysis (Blocking on critical)
 *
 * After Python/R code execution, captures and analyzes stderr output:
 * - Deprecation warnings
 * - SettingWithCopyWarning (blocks — can cause silent data corruption)
 * - DtypeWarning (blocks — can cause silent type coercion)
 * - Memory warnings
 * - Import errors
 * - Traceback analysis
 *
 * Returns:
 *   string = pass-through (no critical issues or non-calc command)
 *   { exitCode: 2, stderr: string } = block on critical stderr issues
 */

'use strict';

const { log } = require('../lib/utils');
const { CODE_PATTERNS } = require('./post-calc-save');

/**
 * Analyze stderr content for known patterns
 * @param {string} stderr - Stderr output
 * @returns {Array<{level: string, category: string, message: string}>}
 */
function analyzeStderr(stderr) {
  if (!stderr || stderr.trim() === '') return [];

  const issues = [];
  const lines = stderr.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Critical errors
    if (/Traceback|Error:|Exception:/.test(trimmed)) {
      if (/ModuleNotFoundError|ImportError/.test(trimmed)) {
        issues.push({ level: 'critical', category: 'import', message: trimmed });
      } else if (/MemoryError/.test(trimmed)) {
        issues.push({ level: 'critical', category: 'memory', message: '内存不足: ' + trimmed });
      } else if (/SyntaxError/.test(trimmed)) {
        issues.push({ level: 'critical', category: 'syntax', message: trimmed });
      } else {
        issues.push({ level: 'critical', category: 'error', message: trimmed });
      }
    }

    // Warnings
    if (/Warning|warning|WARN/.test(trimmed)) {
      if (/SettingWithCopyWarning/.test(trimmed)) {
        issues.push({
          level: 'critical',
          category: 'pandas',
          message: 'SettingWithCopyWarning: 可能修改了切片而非副本，建议使用 .loc[] 或 .copy()',
        });
      } else if (/FutureWarning/.test(trimmed)) {
        issues.push({ level: 'info', category: 'deprecation', message: trimmed });
      } else if (/DeprecationWarning/.test(trimmed)) {
        issues.push({ level: 'info', category: 'deprecation', message: trimmed });
      } else if (/PerformanceWarning/.test(trimmed)) {
        issues.push({ level: 'warning', category: 'performance', message: trimmed });
      } else {
        issues.push({ level: 'warning', category: 'other', message: trimmed });
      }
    }

    // Dtype warnings
    if (/DtypeWarning/.test(trimmed)) {
      issues.push({
        level: 'critical',
        category: 'dtype',
        message: '列数据类型不一致，可能导致隐式类型转换，建议指定 dtype 参数',
      });
    }

    // Parser warnings
    if (/ParserWarning/.test(trimmed)) {
      issues.push({
        level: 'warning',
        category: 'parser',
        message: 'CSV解析警告: 可能存在列数不一致',
      });
    }
  }

  return issues;
}

/**
 * Deduplicate issues by category+message
 * @param {Array} issues
 * @returns {Array}
 */
function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter(i => {
    const key = `${i.category}:${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const command = data.command || data.tool_input?.command || '';
    const stderr = data.stderr || data.result?.stderr || '';

    // Only check calculation commands
    let isCalc = false;
    for (const pat of CODE_PATTERNS) {
      if (pat.regex.test(command)) {
        isCalc = true;
        break;
      }
    }
    if (!isCalc) return rawInput;

    // Analyze stderr
    const issues = deduplicateIssues(analyzeStderr(stderr));

    if (issues.length > 0) {
      const critical = issues.filter(i => i.level === 'critical');
      const warnings = issues.filter(i => i.level === 'warning');
      const infos = issues.filter(i => i.level === 'info');

      const lines = ['[Stderr] Python/R 执行输出分析:'];

      if (critical.length > 0) {
        lines.push(`  ❌ ${critical.length} 个严重错误:`);
        for (const issue of critical) {
          lines.push(`    ❌ [${issue.category}] ${issue.message}`);
        }
      }

      if (warnings.length > 0) {
        lines.push(`  ⚠️ ${warnings.length} 个警告:`);
        for (const issue of warnings.slice(0, 5)) {
          lines.push(`    ⚠️ [${issue.category}] ${issue.message}`);
        }
        if (warnings.length > 5) {
          lines.push(`    ... 还有 ${warnings.length - 5} 个警告`);
        }
      }

      if (infos.length > 0) {
        lines.push(`  ℹ️ ${infos.length} 个信息`);
      }

      // Provide fix suggestions for common issues
      const categories = new Set(issues.map(i => i.category));
      if (categories.has('import')) {
        lines.push('  💡 建议: 使用 pip install <package> 安装缺失的包');
      }
      if (categories.has('pandas')) {
        lines.push('  💡 建议: 使用 df.loc[:, col] = value 或 df[col].copy() 避免 SettingWithCopyWarning');
      }
      if (categories.has('memory')) {
        lines.push('  💡 建议: 减小数据集大小或使用 chunksize 分批处理');
      }

      // Block on critical issues (SettingWithCopyWarning, DtypeWarning, errors)
      if (critical.length > 0) {
        lines.push('  🚫 必须修复上述严重问题后才能继续。');
        log('Stderr', `BLOCKED: ${critical.length} critical stderr issues`);
        return { exitCode: 2, stderr: lines.join('\n') + '\n' };
      }

      // Non-critical: log to stderr and pass through
      process.stderr.write(lines.join('\n') + '\n');
      log('Stderr', `Analyzed: ${critical.length} critical, ${warnings.length} warnings`);
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
    process.stdout.write(result);
  });
}

module.exports = { run, analyzeStderr, deduplicateIssues };
