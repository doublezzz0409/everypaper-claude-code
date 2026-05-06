#!/usr/bin/env node
/**
 * PostToolUse:Bash Hook — Figure Quality Verification (Blocking)
 *
 * After figure generation commands (plt.savefig, ggsave), verifies:
 * - Output file exists and is non-empty
 * - DPI meets 300+ standard
 * - Labels are present
 */

'use strict';

var fs = require('fs');
var path = require('path');
var figureQa = require('../lib/figure-qa');
var utils = require('../lib/utils');

var FIGURE_COMMAND_PATTERNS = [
  { regex: /plt\.savefig/i, name: 'matplotlib' },
  { regex: /ggsave/i, name: 'ggplot2' },
  { regex: /savefig|save_plot|save_figure/i, name: 'generic' }
];

function run(rawInput) {
  try {
    var data = JSON.parse(rawInput);
    var command = data.command || (data.tool_input ? data.tool_input.command : '') || '';
    var exitCode = data.exit_code || (data.result ? data.result.exit_code : 0) || 0;

    var isFigureCmd = false;
    for (var p = 0; p < FIGURE_COMMAND_PATTERNS.length; p++) {
      if (FIGURE_COMMAND_PATTERNS[p].regex.test(command)) { isFigureCmd = true; break; }
    }
    if (!isFigureCmd || exitCode !== 0) return rawInput;

    var outputMatch = command.match(/savefig\s*\(\s*['"]([^'"]+)['"]/i)
      || command.match(/ggsave\s*\(\s*['"]([^'"]+)['"]/i);

    if (!outputMatch) return rawInput;

    var outputPath = path.resolve(outputMatch[1]);

    if (!fs.existsSync(outputPath)) {
      return { exitCode: 2, stderr: '[FigureQA] ❌ 图表文件未生成: ' + path.basename(outputPath) + '\n' };
    }

    var stat = fs.statSync(outputPath);
    var issues = [];
    if (stat.size < 1024) {
      issues.push({ level: 'critical', message: '图表文件过小 (<1KB)，可能渲染失败' });
    }

    var specPath = outputPath.replace(/\.(png|pdf|svg|eps)$/, '-spec.json');
    if (fs.existsSync(specPath)) {
      try {
        var spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
        var specResult = figureQa.validateSpec(spec);
        issues = issues.concat(specResult.issues);
      } catch (e) { /* ignore parse errors */ }
    }

    if (issues.length > 0) {
      var critical = issues.filter(function(x) { return x.level === 'critical'; });
      var lines = ['[FigureQA] 图表质量检查:'];
      for (var i = 0; i < issues.length; i++) {
        var icon = issues[i].level === 'critical' ? '❌' : '⚠️';
        lines.push('  ' + icon + ' ' + issues[i].message);
      }
      if (critical.length > 0) {
        utils.log('FigureQA', 'BLOCKED: figure quality issues');
        return { exitCode: 2, stderr: lines.join('\n') + '\n' };
      }
      process.stderr.write(lines.join('\n') + '\n');
    }

    return rawInput;
  } catch (e) {
    return rawInput;
  }
}

if (require.main === module) {
  var input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', function(chunk) { input += chunk; });
  process.stdin.on('end', function() {
    var result = run(input);
    if (result && typeof result === 'object' && result.exitCode) {
      process.stderr.write(result.stderr || '');
      process.exit(result.exitCode);
    }
    process.stdout.write(result);
  });
}

module.exports = { run: run };
