#!/usr/bin/env node
/**
 * PostToolUse:Write|Edit Hook — Cross-Reference Check (Blocking)
 *
 * After writing paper content, verifies cross-references:
 * Tables/Figures cited in text actually exist in schema.
 */

'use strict';

var paperSchema = require('../lib/paper-schema');
var xrefResolver = require('../lib/xref-resolver');
var utils = require('../lib/utils');

function isPaperSectionFile(filePath) {
  return filePath && filePath.indexOf('output/sections/') !== -1 && filePath.endsWith('.md');
}

function run(rawInput) {
  try {
    var data = JSON.parse(rawInput);
    var filePath = data.tool_input ? data.tool_input.file_path : '';
    var content = data.tool_input ? data.tool_input.content : '';

    if (!isPaperSectionFile(filePath)) return rawInput;
    if (!content) return rawInput;

    var schema = paperSchema.loadSchema();
    if (!schema) return rawInput;

    var result = xrefResolver.checkForwardRefs(content, schema);
    if (result.issues.length > 0) {
      var critical = result.issues.filter(function(x) { return x.level === 'critical'; });
      var lines = ['[XRef] 交叉引用检查:'];
      for (var i = 0; i < result.issues.length; i++) {
        var icon = result.issues[i].level === 'critical' ? '❌' : '⚠️';
        lines.push('  ' + icon + ' ' + result.issues[i].message);
      }
      if (critical.length > 0) {
        lines.push('  🚫 引用了不存在的图表，必须修复。');
        utils.log('XRef', 'BLOCKED: forward reference to nonexistent item');
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

module.exports = { run: run, isPaperSectionFile: isPaperSectionFile };
