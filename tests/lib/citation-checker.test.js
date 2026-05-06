#!/usr/bin/env node
'use strict';

var cc = require('../../scripts/lib/citation-checker');

module.exports = function(ctx) {
  ctx.assert(typeof cc.extractCitations === 'function', 'extractCitations exported');
  ctx.assert(typeof cc.detectStyle === 'function', 'detectStyle exported');
  ctx.assert(typeof cc.checkConsistency === 'function', 'checkConsistency exported');
  ctx.assert(typeof cc.checkReferenceCompleteness === 'function', 'checkReferenceCompleteness exported');

  // extractCitations — APA
  var apa = cc.extractCitations('As shown by (Zhang, 2023) and (Li et al., 2022).');
  ctx.assert(apa.length === 2, 'extracted 2 APA citations');
  ctx.assertEqual(apa[0].style, 'apa', 'first is APA');
  ctx.assert(apa[0].text.indexOf('Zhang') !== -1, 'first contains Zhang');

  // extractCitations — GB
  var gb = cc.extractCitations('As shown in [1] and [2-3].');
  ctx.assert(gb.length >= 1, 'extracted GB citations');
  ctx.assertEqual(gb[0].style, 'gb', 'first is GB');

  // extractCitations — empty
  var empty = cc.extractCitations('');
  ctx.assert(empty.length === 0, 'empty content no citations');

  // detectStyle
  var style1 = cc.detectStyle(apa);
  ctx.assertEqual(style1, 'apa', 'detectStyle APA');
  var style2 = cc.detectStyle(gb);
  ctx.assertEqual(style2, 'gb', 'detectStyle GB');
  var style3 = cc.detectStyle([]);
  ctx.assertEqual(style3, 'unknown', 'detectStyle unknown');

  // checkConsistency — consistent
  var r1 = cc.checkConsistency('As shown by (Zhang, 2023).', 'apa');
  ctx.assert(r1.ok === true, 'consistent APA ok');
  ctx.assert(r1.issues.length === 0, 'no issues for consistent');

  // checkConsistency — inconsistent
  var r2 = cc.checkConsistency('As shown in [1] by (Zhang, 2023).', 'gb');
  ctx.assert(r2.issues.length > 0, 'mixed style has issues');

  // checkConsistency — empty
  var r3 = cc.checkConsistency('', 'apa');
  ctx.assert(r3.ok === true, 'empty content ok');
};
