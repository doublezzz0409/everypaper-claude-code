#!/usr/bin/env node
/**
 * Citation Checker — Citation Format Consistency
 *
 * Extracts citations from content, detects citation style,
 * and checks consistency with the expected style.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var utils = require('./utils');

var STYLE_PATTERNS = {
  apa: /\([A-Z][a-z]+(?:\s+et\s+al\.)?,?\s*\d{4}[a-z]?\)/g,
  mla: /\([A-Z][a-z]+\s+\d+\)/g,
  chicago: /\([A-Z][a-z]+\s+\d{4},\s*\d+\)/g,
  gb: /\[\d+(?:[-–,]\d+)*\]/g
};

function extractCitations(content) {
  if (!content || typeof content !== 'string') return [];
  var citations = [];
  var styles = Object.keys(STYLE_PATTERNS);
  for (var si = 0; si < styles.length; si++) {
    var style = styles[si];
    var regex = new RegExp(STYLE_PATTERNS[style].source, 'g');
    var match;
    while ((match = regex.exec(content)) !== null) {
      citations.push({ style: style, text: match[0], position: match.index });
    }
  }
  citations.sort(function(a, b) { return a.position - b.position; });
  return citations;
}

function detectStyle(citations) {
  if (!citations || citations.length === 0) return 'unknown';
  var counts = {};
  for (var i = 0; i < citations.length; i++) {
    var s = citations[i].style;
    counts[s] = (counts[s] || 0) + 1;
  }
  var best = 'unknown';
  var bestCount = 0;
  var keys = Object.keys(counts);
  for (var k = 0; k < keys.length; k++) {
    if (counts[keys[k]] > bestCount) {
      bestCount = counts[keys[k]];
      best = keys[k];
    }
  }
  return best;
}

function checkConsistency(content, expectedStyle) {
  if (!content || typeof content !== 'string') return { ok: true, issues: [] };
  var citations = extractCitations(content);
  var issues = [];
  for (var i = 0; i < citations.length; i++) {
    if (citations[i].style !== expectedStyle && citations[i].style !== 'unknown') {
      issues.push({
        level: 'warning',
        message: '引用格式不一致: "' + citations[i].text + '" 是 ' + citations[i].style + ' 格式，期望 ' + expectedStyle
      });
    }
  }
  return { ok: !issues.some(function(x) { return x.level === 'critical'; }), issues: issues };
}

function checkReferenceCompleteness(content, refsJsonPath) {
  var issues = [];
  if (!content || typeof content !== 'string') return { ok: true, issues: [] };

  var citedInText = [];
  var apaMatches = content.match(STYLE_PATTERNS.apa) || [];
  var gbMatches = content.match(STYLE_PATTERNS.gb) || [];
  citedInText = citedInText.concat(apaMatches, gbMatches);

  if (refsJsonPath && fs.existsSync(refsJsonPath)) {
    try {
      var refs = JSON.parse(fs.readFileSync(refsJsonPath, 'utf8'));
      if (Array.isArray(refs)) {
        for (var i = 0; i < refs.length; i++) {
          var ref = refs[i];
          var authorYear = ref.authors ? ref.authors.split(',')[0].trim().split(' ').pop() : '';
          var year = ref.year || '';
          var pattern = '(' + authorYear + ', ' + year + ')';
          var found = citedInText.some(function(c) { return c.indexOf(authorYear) !== -1 && c.indexOf(year) !== -1; });
          if (!found && authorYear && year) {
            issues.push({
              level: 'info',
              message: '参考文献 "' + (ref.title || authorYear) + '" 未在正文中被引用'
            });
          }
        }
      }
    } catch (e) { /* ignore parse errors */ }
  }

  return { ok: !issues.some(function(x) { return x.level === 'critical'; }), issues: issues };
}

module.exports = {
  STYLE_PATTERNS: STYLE_PATTERNS,
  extractCitations: extractCitations,
  detectStyle: detectStyle,
  checkConsistency: checkConsistency,
  checkReferenceCompleteness: checkReferenceCompleteness
};
