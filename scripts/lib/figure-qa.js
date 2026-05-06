#!/usr/bin/env node
/**
 * Figure Quality Assurance
 *
 * Validates figure specs and generated figure outputs against
 * academic quality standards (DPI, fonts, labels).
 */

'use strict';

var fs = require('fs');
var path = require('path');
var utils = require('./utils');

var FIGURE_DEFAULTS_FILE = function() {
  return path.join(utils.getProjectDir(), 'defaults', 'figure-defaults.json');
};

function loadFigureDefaults() {
  return utils.readJson(FIGURE_DEFAULTS_FILE()) || {
    dpi: 300,
    figsize: [6, 4],
    font_family: 'Times New Roman',
    font_size: 11,
    title_font_size: 12,
    label_font_size: 11,
    legend_font_size: 10,
    palette: 'colorblind-safe',
    line_width: 1.5,
    marker_size: 6,
    alpha: 0.8,
    grid: true,
    tight_layout: true,
    format: 'png'
  };
}

function validateSpec(spec) {
  var defaults = loadFigureDefaults();
  var issues = [];

  var normalized = {
    type: spec.type || 'unknown',
    title: spec.title || '',
    data_source: spec.data_source || '',
    x: spec.x || {},
    y: spec.y || {},
    style: Object.assign({}, defaults, spec.style || {})
  };

  if (normalized.style.dpi < 300) {
    issues.push({ level: 'critical', message: 'DPI ' + normalized.style.dpi + ' < 300，不满足印刷标准' });
  }
  if (normalized.style.font_size < 8) {
    issues.push({ level: 'warning', message: '字体 ' + normalized.style.font_size + 'pt < 8pt，可能看不清' });
  }
  if (!spec.x || !spec.x.label) {
    issues.push({ level: 'warning', message: 'X 轴缺少标签' });
  }
  if (!spec.y || !spec.y.label) {
    issues.push({ level: 'warning', message: 'Y 轴缺少标签' });
  }
  if (!spec.title) {
    issues.push({ level: 'warning', message: '图表缺少标题' });
  }

  return { ok: !issues.some(function(x) { return x.level === 'critical'; }), issues: issues, normalized: normalized };
}

function verifyOutput(outputPath) {
  var issues = [];
  if (!fs.existsSync(outputPath)) {
    return { ok: false, issues: [{ level: 'critical', message: '图表文件不存在: ' + path.basename(outputPath) }] };
  }
  var stat = fs.statSync(outputPath);
  if (stat.size < 1024) {
    issues.push({ level: 'critical', message: '图表文件过小 (' + stat.size + ' bytes)，可能渲染失败' });
  }
  return { ok: !issues.some(function(x) { return x.level === 'critical'; }), issues: issues };
}

module.exports = {
  loadFigureDefaults: loadFigureDefaults,
  validateSpec: validateSpec,
  verifyOutput: verifyOutput
};
