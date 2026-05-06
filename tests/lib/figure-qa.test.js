#!/usr/bin/env node
'use strict';

var path = require('path');
var fs = require('fs');
var os = require('os');

var figureQa = require('../../scripts/lib/figure-qa');

module.exports = function(ctx) {
  ctx.assert(typeof figureQa.loadFigureDefaults === 'function', 'loadFigureDefaults exported');
  ctx.assert(typeof figureQa.validateSpec === 'function', 'validateSpec exported');
  ctx.assert(typeof figureQa.verifyOutput === 'function', 'verifyOutput exported');

  var origCwd = process.cwd();
  var tmpDir = path.join(os.tmpdir(), 'everypaper-figqa-test-' + Date.now());
  var defaultsDir = path.join(tmpDir, 'defaults');
  fs.mkdirSync(defaultsDir, { recursive: true });

  fs.writeFileSync(path.join(defaultsDir, 'figure-defaults.json'), JSON.stringify({
    dpi: 300, figsize: [6, 4], font_size: 11, font_family: 'Times New Roman',
    title_font_size: 12, label_font_size: 11, legend_font_size: 10
  }), 'utf8');

  process.chdir(tmpDir);

  try {
    // loadFigureDefaults
    var defs = figureQa.loadFigureDefaults();
    ctx.assert(defs.dpi === 300, 'default dpi 300');
    ctx.assert(defs.font_size === 11, 'default font_size 11');

    // validateSpec — normal
    var r1 = figureQa.validateSpec({
      type: 'scatter',
      title: 'Test',
      x: { label: 'X' },
      y: { label: 'Y' },
      style: { dpi: 300, font_size: 11 }
    });
    ctx.assert(r1.ok === true, 'normal spec ok');
    ctx.assert(r1.issues.length === 0, 'no issues');
    ctx.assert(r1.normalized.style.dpi === 300, 'normalized has dpi');

    // validateSpec — missing labels
    var r2 = figureQa.validateSpec({ type: 'bar', style: { dpi: 300 } });
    ctx.assert(r2.issues.length > 0, 'missing labels has issues');

    // validateSpec — low DPI
    var r3 = figureQa.validateSpec({
      title: 'Test', x: { label: 'X' }, y: { label: 'Y' },
      style: { dpi: 72, font_size: 11 }
    });
    ctx.assert(r3.ok === false, 'low DPI not ok');
    ctx.assert(r3.issues[0].level === 'critical', 'low DPI is critical');

    // validateSpec — small font
    var r4 = figureQa.validateSpec({
      title: 'Test', x: { label: 'X' }, y: { label: 'Y' },
      style: { dpi: 300, font_size: 6 }
    });
    var hasFontWarning = r4.issues.some(function(i) { return i.message.indexOf('字体') !== -1; });
    ctx.assert(hasFontWarning, 'small font has warning');

    // validateSpec — fills defaults
    var r5 = figureQa.validateSpec({ title: 'T', x: { label: 'X' }, y: { label: 'Y' } });
    ctx.assert(r5.normalized.style.dpi === 300, 'fills default dpi');
    ctx.assert(r5.normalized.style.font_size === 11, 'fills default font_size');

    // verifyOutput — existing file
    var testFile = path.join(tmpDir, 'test.png');
    fs.writeFileSync(testFile, Buffer.alloc(2048));
    var r6 = figureQa.verifyOutput(testFile);
    ctx.assert(r6.ok === true, 'existing file ok');

    // verifyOutput — missing file
    var r7 = figureQa.verifyOutput('/nonexistent/file.png');
    ctx.assert(r7.ok === false, 'missing file not ok');

    // verifyOutput — tiny file
    var tinyFile = path.join(tmpDir, 'tiny.png');
    fs.writeFileSync(tinyFile, Buffer.alloc(100));
    var r8 = figureQa.verifyOutput(tinyFile);
    ctx.assert(r8.ok === false, 'tiny file not ok');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
