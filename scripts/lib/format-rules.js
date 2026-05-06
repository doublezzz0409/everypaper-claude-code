#!/usr/bin/env node
/**
 * Format Rules Engine
 *
 * Loads format defaults and overrides, checks section structure,
 * abstract word count, keyword count, and table formatting.
 */

'use strict';

var path = require('path');
var utils = require('./utils');

var DEFAULTS_FILE = function() { return path.join(utils.getProjectDir(), 'defaults', 'format-defaults.json'); };
var OVERRIDES_FILE = function() { return path.join(utils.getOutputDir(), 'format-overrides.json'); };

function loadDefaults() {
  return utils.readJson(DEFAULTS_FILE()) || {};
}

function loadOverrides() {
  return utils.readJson(OVERRIDES_FILE()) || {};
}

function getEffectiveConfig() {
  var defaults = loadDefaults();
  var overrides = loadOverrides();
  var config = {};
  var keys = Object.keys(defaults);
  for (var i = 0; i < keys.length; i++) { config[keys[i]] = defaults[keys[i]]; }
  keys = Object.keys(overrides);
  for (var j = 0; j < keys.length; j++) {
    var key = keys[j];
    if (overrides[key] !== null && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      config[key] = Object.assign({}, config[key] || {}, overrides[key]);
    } else {
      config[key] = overrides[key];
    }
  }
  return config;
}

function checkSectionStructure(sections) {
  var config = getEffectiveConfig();
  var required = config.required_sections || [];
  var existing = [];
  for (var i = 0; i < sections.length; i++) {
    if (sections[i].type && existing.indexOf(sections[i].type) === -1) {
      existing.push(sections[i].type);
    }
  }
  var missing = [];
  for (var r = 0; r < required.length; r++) {
    if (existing.indexOf(required[r]) === -1) { missing.push(required[r]); }
  }
  var issues = [];
  for (var m = 0; m < missing.length; m++) {
    issues.push({ level: 'critical', message: '缺少必需章节: ' + missing[m] });
  }
  return { ok: issues.length === 0, issues: issues };
}

function checkSectionOrder(sections) {
  var config = getEffectiveConfig();
  var order = config.section_order || [];
  var issues = [];
  var lastIndex = -1;
  for (var i = 0; i < sections.length; i++) {
    var idx = order.indexOf(sections[i].type);
    if (idx === -1) continue;
    if (idx < lastIndex) {
      issues.push({ level: 'warning', message: '章节顺序异常: "' + sections[i].title + '" 出现在预期位置之前' });
    }
    lastIndex = idx;
  }
  return { ok: !issues.some(function(x) { return x.level === 'critical'; }), issues: issues };
}

function checkAbstract(content, config) {
  config = config || getEffectiveConfig();
  var ac = config.abstract || {};
  var minW = ac.word_min || 150;
  var maxW = ac.word_max || 300;
  var words = content.trim().split(/\s+/).filter(function(w) { return w.length > 0; });
  var wc = words.length;
  var issues = [];
  if (wc < minW) { issues.push({ level: 'warning', message: '摘要字数不足: ' + wc + ' 词 (最少 ' + minW + ')' }); }
  if (wc > maxW) { issues.push({ level: 'warning', message: '摘要字数过多: ' + wc + ' 词 (最多 ' + maxW + ')' }); }
  return { ok: !issues.some(function(x) { return x.level === 'critical'; }), issues: issues, wordCount: wc };
}

function checkKeywords(keywords, config) {
  config = config || getEffectiveConfig();
  var kc = config.keywords || {};
  var minC = kc.min_count || 3;
  var maxC = kc.max_count || 5;
  var count = Array.isArray(keywords) ? keywords.length : 0;
  var issues = [];
  if (count < minC) { issues.push({ level: 'warning', message: '关键词数量不足: ' + count + ' 个 (最少 ' + minC + ')' }); }
  if (count > maxC) { issues.push({ level: 'warning', message: '关键词数量过多: ' + count + ' 个 (最多 ' + maxC + ')' }); }
  return { ok: !issues.some(function(x) { return x.level === 'critical'; }), issues: issues };
}

function checkTableFormat(content) {
  var issues = [];
  if (!content || typeof content !== 'string') { return { ok: true, issues: [] }; }
  if (!/Note\.|注[:：]/i.test(content)) {
    issues.push({ level: 'info', message: '表格缺少 Note 注释行' });
  }
  return { ok: !issues.some(function(x) { return x.level === 'critical'; }), issues: issues };
}

function formatIssues(label, issues) {
  if (!issues || issues.length === 0) return '';
  var lines = ['[Format] ' + label + ' 格式检查:'];
  for (var i = 0; i < issues.length; i++) {
    var icon = issues[i].level === 'critical' ? '❌' : issues[i].level === 'warning' ? '⚠️' : 'ℹ️';
    lines.push('  ' + icon + ' ' + issues[i].message);
  }
  return lines.join('\n');
}

module.exports = {
  loadDefaults: loadDefaults,
  loadOverrides: loadOverrides,
  getEffectiveConfig: getEffectiveConfig,
  checkSectionStructure: checkSectionStructure,
  checkSectionOrder: checkSectionOrder,
  checkAbstract: checkAbstract,
  checkKeywords: checkKeywords,
  checkTableFormat: checkTableFormat,
  formatIssues: formatIssues
};
