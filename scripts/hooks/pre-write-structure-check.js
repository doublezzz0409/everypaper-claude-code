#!/usr/bin/env node
/**
 * PreToolUse:Write|Edit Hook — Section Structure Check (Blocking)
 *
 * Before writing paper content, verifies required sections exist.
 * Blocks if required sections are missing after ≥2 sections are drafted.
 */

'use strict';

var path = require('path');
var paperSchema = require('../lib/paper-schema');
var formatRules = require('../lib/format-rules');
var utils = require('../lib/utils');

var SECTION_TYPE_MAP = {
  'intro': 'introduction',
  'literature': 'literature_review',
  'method': 'methodology',
  'result': 'results',
  'discuss': 'discussion',
  'conclu': 'conclusion',
  'abstract': 'abstract',
  'reference': 'references'
};

var CONTENT_TYPE_PATTERNS = [
  { regex: /^#\s+.*(?:引言|Introduction)/i, type: 'introduction' },
  { regex: /^#\s+.*(?:文献|Literature)/i, type: 'literature_review' },
  { regex: /^#\s+.*(?:方法|Method)/i, type: 'methodology' },
  { regex: /^#\s+.*(?:结果|Result)/i, type: 'results' },
  { regex: /^#\s+.*(?:讨论|Discussion)/i, type: 'discussion' },
  { regex: /^#\s+.*(?:结论|Conclusion)/i, type: 'conclusion' },
  { regex: /^#\s+.*(?:摘要|Abstract)/i, type: 'abstract' }
];

function inferSectionType(content, filePath) {
  var fileName = path.basename(filePath).toLowerCase();
  var keys = Object.keys(SECTION_TYPE_MAP);
  for (var i = 0; i < keys.length; i++) {
    if (fileName.indexOf(keys[i]) !== -1) return SECTION_TYPE_MAP[keys[i]];
  }
  if (content) {
    var firstLines = content.substring(0, 500);
    for (var p = 0; p < CONTENT_TYPE_PATTERNS.length; p++) {
      if (CONTENT_TYPE_PATTERNS[p].regex.test(firstLines)) return CONTENT_TYPE_PATTERNS[p].type;
    }
  }
  return null;
}

function isPaperSectionFile(filePath) {
  return filePath && filePath.indexOf('output/sections/') !== -1 && filePath.endsWith('.md');
}

function run(rawInput) {
  try {
    var data = JSON.parse(rawInput);
    var filePath = data.tool_input ? data.tool_input.file_path : '';
    var content = data.tool_input ? data.tool_input.content : '';

    if (!isPaperSectionFile(filePath)) return rawInput;

    var schema = paperSchema.loadSchema();
    if (!schema) return rawInput;

    var sectionType = inferSectionType(content, filePath);
    var allTypes = [];
    for (var i = 0; i < schema.sections.length; i++) {
      if (schema.sections[i].type && allTypes.indexOf(schema.sections[i].type) === -1) {
        allTypes.push(schema.sections[i].type);
      }
    }
    if (sectionType && allTypes.indexOf(sectionType) === -1) {
      allTypes.push(sectionType);
    }

    if (allTypes.length < 2) return rawInput;

    var result = formatRules.checkSectionStructure(schema.sections);
    if (!result.ok) {
      var lines = ['[Structure] ❌ 缺少必需章节:'];
      for (var m = 0; m < result.issues.length; m++) {
        lines.push('  ❌ ' + result.issues[m].message);
      }
      lines.push('  🚫 请先完成必需章节后再继续。');
      utils.log('Structure', 'BLOCKED: missing required sections');
      return { exitCode: 2, stderr: lines.join('\n') + '\n' };
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

module.exports = { run: run, inferSectionType: inferSectionType, isPaperSectionFile: isPaperSectionFile };
