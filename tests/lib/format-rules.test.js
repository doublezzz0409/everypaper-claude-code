#!/usr/bin/env node
'use strict';

var path = require('path');
var fs = require('fs');
var os = require('os');

var formatRules = require('../../scripts/lib/format-rules');

module.exports = function(ctx) {
  ctx.assert(typeof formatRules.loadDefaults === 'function', 'loadDefaults exported');
  ctx.assert(typeof formatRules.getEffectiveConfig === 'function', 'getEffectiveConfig exported');
  ctx.assert(typeof formatRules.checkSectionStructure === 'function', 'checkSectionStructure exported');
  ctx.assert(typeof formatRules.checkSectionOrder === 'function', 'checkSectionOrder exported');
  ctx.assert(typeof formatRules.checkAbstract === 'function', 'checkAbstract exported');
  ctx.assert(typeof formatRules.checkKeywords === 'function', 'checkKeywords exported');
  ctx.assert(typeof formatRules.checkTableFormat === 'function', 'checkTableFormat exported');
  ctx.assert(typeof formatRules.formatIssues === 'function', 'formatIssues exported');

  var origCwd = process.cwd();
  var tmpDir = path.join(os.tmpdir(), 'everypaper-format-test-' + Date.now());
  var defaultsDir = path.join(tmpDir, 'defaults');
  var outputDir = path.join(tmpDir, 'output');
  fs.mkdirSync(defaultsDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(path.join(defaultsDir, 'format-defaults.json'), JSON.stringify({
    citation_style: 'apa',
    required_sections: ['introduction', 'literature_review', 'methodology', 'results', 'conclusion'],
    section_order: ['abstract', 'introduction', 'literature_review', 'methodology', 'results', 'discussion', 'conclusion'],
    abstract: { word_min: 150, word_max: 300 },
    keywords: { min_count: 3, max_count: 5 }
  }), 'utf8');

  process.chdir(tmpDir);

  try {
    // loadDefaults
    var defaults = formatRules.loadDefaults();
    ctx.assert(defaults.citation_style === 'apa', 'loadDefaults has citation_style');
    ctx.assert(Array.isArray(defaults.required_sections), 'required_sections is array');

    // getEffectiveConfig without overrides
    var config = formatRules.getEffectiveConfig();
    ctx.assert(config.citation_style === 'apa', 'effective config has defaults');

    // getEffectiveConfig with overrides
    fs.writeFileSync(path.join(outputDir, 'format-overrides.json'), JSON.stringify({
      citation_style: 'gb'
    }), 'utf8');
    var config2 = formatRules.getEffectiveConfig();
    ctx.assertEqual(config2.citation_style, 'gb', 'overrides take precedence');

    // checkSectionStructure — all present
    var sections = [
      { type: 'introduction' },
      { type: 'literature_review' },
      { type: 'methodology' },
      { type: 'results' },
      { type: 'conclusion' }
    ];
    var r1 = formatRules.checkSectionStructure(sections);
    ctx.assert(r1.ok === true, 'all sections present ok');

    // checkSectionStructure — missing
    var sections2 = [
      { type: 'introduction' },
      { type: 'results' }
    ];
    var r2 = formatRules.checkSectionStructure(sections2);
    ctx.assert(r2.ok === false, 'missing sections not ok');
    ctx.assert(r2.issues.length > 0, 'has issues for missing');

    // checkSectionOrder — correct
    var sections3 = [
      { type: 'introduction', title: '1. Intro' },
      { type: 'literature_review', title: '2. Lit' },
      { type: 'methodology', title: '3. Method' }
    ];
    var r3 = formatRules.checkSectionOrder(sections3);
    ctx.assert(r3.issues.length === 0, 'correct order no issues');

    // checkAbstract — normal
    var longText = 'word '.repeat(200);
    var r4 = formatRules.checkAbstract(longText);
    ctx.assert(r4.ok === true, 'normal abstract ok');
    ctx.assert(r4.wordCount === 200, 'word count correct');

    // checkAbstract — too short
    var r5 = formatRules.checkAbstract('short text');
    ctx.assert(r5.issues.length > 0, 'short abstract has issues');

    // checkKeywords — normal
    var r6 = formatRules.checkKeywords(['a', 'b', 'c']);
    ctx.assert(r6.ok === true, '3 keywords ok');

    // checkKeywords — too few
    var r7 = formatRules.checkKeywords(['a']);
    ctx.assert(r7.issues.length > 0, '1 keyword has issues');

    // formatIssues
    var msg = formatRules.formatIssues('test', [{ level: 'critical', message: 'err' }]);
    ctx.assert(msg.includes('test'), 'formatIssues includes label');
    ctx.assert(msg.includes('❌'), 'formatIssues includes icon');
    ctx.assertEqual(formatRules.formatIssues('x', []), '', 'empty issues empty string');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
