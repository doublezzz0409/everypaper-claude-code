#!/usr/bin/env node
/**
 * Cross-Reference Resolver
 *
 * Extracts and validates cross-references (Table/Figure/Equation)
 * between paper content and schema.
 */

'use strict';

var REF_PATTERNS = {
  table: /(?:Table|TABLE|表)\s*(\d+)/g,
  figure: /(?:Figure|FIGURE|Fig\.?|图)\s*(\d+)/g,
  equation: /(?:Eq\.?|Equation|公式)\s*\(?\s*(\d+)\s*\)?/g
};

function extractRefs(content) {
  if (!content || typeof content !== 'string') return [];
  var refs = [];
  var types = Object.keys(REF_PATTERNS);
  for (var ti = 0; ti < types.length; ti++) {
    var type = types[ti];
    var regex = new RegExp(REF_PATTERNS[type].source, 'g');
    var match;
    while ((match = regex.exec(content)) !== null) {
      refs.push({ type: type, number: parseInt(match[1], 10), text: match[0], position: match.index });
    }
  }
  refs.sort(function(a, b) { return a.position - b.position; });
  return refs;
}

function checkForwardRefs(content, schema) {
  if (!content || !schema) return { ok: true, issues: [] };
  var refs = extractRefs(content);
  var issues = [];
  for (var i = 0; i < refs.length; i++) {
    var ref = refs[i];
    if (ref.type === 'table') {
      var exists = schema.tables && schema.tables.some(function(t) { return t.number === ref.number; });
      if (!exists) {
        issues.push({ level: 'critical', message: '引用了不存在的 Table ' + ref.number });
      }
    }
    if (ref.type === 'figure') {
      var fexists = schema.figures && schema.figures.some(function(f) { return f.number === ref.number; });
      if (!fexists) {
        issues.push({ level: 'critical', message: '引用了不存在的 Figure ' + ref.number });
      }
    }
  }
  return { ok: !issues.some(function(x) { return x.level === 'critical'; }), issues: issues };
}

function checkBackwardRefs(schema, content) {
  if (!schema || !content) return { ok: true, issues: [] };
  var issues = [];
  if (schema.tables) {
    for (var ti = 0; ti < schema.tables.length; ti++) {
      var t = schema.tables[ti];
      var tregex = /(?:Table|TABLE|表)\s*\d+/;
      tregex = new RegExp('(?:Table|TABLE|表)\\s*' + t.number + '\\b');
      if (!tregex.test(content)) {
        issues.push({ level: 'warning', message: 'Table ' + t.number + ' 未在正文中被引用' });
      }
    }
  }
  if (schema.figures) {
    for (var fi = 0; fi < schema.figures.length; fi++) {
      var f = schema.figures[fi];
      var fregex = new RegExp('(?:Figure|FIGURE|Fig\\.?|图)\\s*' + f.number + '\\b');
      if (!fregex.test(content)) {
        issues.push({ level: 'warning', message: 'Figure ' + f.number + ' 未在正文中被引用' });
      }
    }
  }
  return { ok: !issues.some(function(x) { return x.level === 'critical'; }), issues: issues };
}

module.exports = {
  REF_PATTERNS: REF_PATTERNS,
  extractRefs: extractRefs,
  checkForwardRefs: checkForwardRefs,
  checkBackwardRefs: checkBackwardRefs
};
