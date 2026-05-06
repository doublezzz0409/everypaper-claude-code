#!/usr/bin/env node
/**
 * PostToolUse:Write|Edit Hook — Numbering Continuity (Warning only)
 *
 * Checks Table/Figure/Equation numbering continuity after writing.
 * Never blocks — only warns on stderr.
 */

'use strict';

var numberingValidator = require('../lib/numbering-validator');

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

    var result = numberingValidator.validateAllNumbering(content);
    if (result.issues.length > 0) {
      var lines = ['[Numbering] 编号检查:'];
      for (var i = 0; i < result.issues.length; i++) {
        lines.push('  ⚠️ ' + result.issues[i].message);
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
    process.stdout.write(result);
  });
}

module.exports = { run: run, isPaperSectionFile: isPaperSectionFile };
