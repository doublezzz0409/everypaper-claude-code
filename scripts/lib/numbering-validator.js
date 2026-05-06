#!/usr/bin/env node
/**
 * Numbering Validator
 *
 * Checks continuity of Table, Figure, and Equation numbering.
 */

'use strict';

var TABLE_REGEX = /(?:Table|TABLE|表)\s*(\d+)/g;
var FIGURE_REGEX = /(?:Figure|FIGURE|Fig\.?|图)\s*(\d+)/g;
var EQUATION_REGEX = /(?:Eq\.?|Equation|公式)\s*\(?\s*(\d+)\s*\)?/g;

function extractNumbers(content, prefix) {
  if (!content || typeof content !== 'string') return [];
  var regex;
  if (prefix === 'Table' || prefix === 'table') {
    regex = new RegExp(TABLE_REGEX.source, 'g');
  } else if (prefix === 'Figure' || prefix === 'figure') {
    regex = new RegExp(FIGURE_REGEX.source, 'g');
  } else if (prefix === 'Eq' || prefix === 'equation') {
    regex = new RegExp(EQUATION_REGEX.source, 'g');
  } else {
    return [];
  }
  var numbers = [];
  var seen = {};
  var match;
  while ((match = regex.exec(content)) !== null) {
    var num = parseInt(match[1], 10);
    if (!seen[num]) { numbers.push(num); seen[num] = true; }
  }
  numbers.sort(function(a, b) { return a - b; });
  return numbers;
}

function checkContinuity(numbers) {
  if (!numbers || numbers.length < 2) return { ok: true, gaps: [] };
  var gaps = [];
  for (var i = 1; i < numbers.length; i++) {
    if (numbers[i] !== numbers[i - 1] + 1) {
      for (var g = numbers[i - 1] + 1; g < numbers[i]; g++) {
        gaps.push(g);
      }
    }
  }
  return { ok: gaps.length === 0, gaps: gaps };
}

function validateAllNumbering(content) {
  if (!content) return { ok: true, issues: [] };
  var issues = [];

  var tableNums = extractNumbers(content, 'Table');
  var tableCheck = checkContinuity(tableNums);
  if (tableCheck.gaps.length > 0) {
    issues.push({ level: 'warning', message: 'Table 编号不连续: 缺少 ' + tableCheck.gaps.join(', ') });
  }

  var figureNums = extractNumbers(content, 'Figure');
  var figureCheck = checkContinuity(figureNums);
  if (figureCheck.gaps.length > 0) {
    issues.push({ level: 'warning', message: 'Figure 编号不连续: 缺少 ' + figureCheck.gaps.join(', ') });
  }

  var eqNums = extractNumbers(content, 'Eq');
  var eqCheck = checkContinuity(eqNums);
  if (eqCheck.gaps.length > 0) {
    issues.push({ level: 'warning', message: 'Equation 编号不连续: 缺少 ' + eqCheck.gaps.join(', ') });
  }

  return { ok: !issues.some(function(x) { return x.level === 'critical'; }), issues: issues };
}

module.exports = {
  extractNumbers: extractNumbers,
  checkContinuity: checkContinuity,
  validateAllNumbering: validateAllNumbering
};
