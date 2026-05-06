#!/usr/bin/env node
/**
 * PreToolUse:Write|Edit Hook — Citation Format Consistency (Warning only)
 *
 * Checks if citation style in the content matches the detected/expected style.
 * Never blocks — only warns on stderr.
 */

'use strict';

var path = require('path');
var paperSchema = require('../lib/paper-schema');
var citationChecker = require('../lib/citation-checker');

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
    var expectedStyle = (schema && schema.citationStyle) || 'apa';

    var result = citationChecker.checkConsistency(content, expectedStyle);
    if (result.issues.length > 0) {
      var lines = ['[Citation] 引用格式检查:'];
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
