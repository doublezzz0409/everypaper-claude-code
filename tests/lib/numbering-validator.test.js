#!/usr/bin/env node
'use strict';

var nv = require('../../scripts/lib/numbering-validator');

module.exports = function(ctx) {
  ctx.assert(typeof nv.extractNumbers === 'function', 'extractNumbers exported');
  ctx.assert(typeof nv.checkContinuity === 'function', 'checkContinuity exported');
  ctx.assert(typeof nv.validateAllNumbering === 'function', 'validateAllNumbering exported');

  // extractNumbers Table
  var t1 = nv.extractNumbers('Table 1, Table 2, Table 3', 'Table');
  ctx.assert(t1.length === 3, 'extracted 3 table numbers');
  ctx.assert(t1[0] === 1 && t1[1] === 2 && t1[2] === 3, 'table numbers 1,2,3');

  // extractNumbers Figure
  var f1 = nv.extractNumbers('Figure 1, Figure 3', 'Figure');
  ctx.assert(f1.length === 2, 'extracted 2 figure numbers');

  // extractNumbers Chinese
  var t2 = nv.extractNumbers('表1, 表2, 表3', 'Table');
  ctx.assert(t2.length === 3, 'extracted 3 Chinese table numbers');

  // extractNumbers dedup
  var t3 = nv.extractNumbers('Table 1 and Table 1 again', 'Table');
  ctx.assert(t3.length === 1, 'deduped table numbers');

  // checkContinuity — continuous
  var c1 = nv.checkContinuity([1, 2, 3]);
  ctx.assert(c1.ok === true, 'continuous ok');
  ctx.assert(c1.gaps.length === 0, 'no gaps');

  // checkContinuity — gap
  var c2 = nv.checkContinuity([1, 3, 4]);
  ctx.assert(c2.ok === false, 'gap not ok');
  ctx.assert(c2.gaps.length === 1, 'one gap');
  ctx.assert(c2.gaps[0] === 2, 'gap is 2');

  // checkContinuity — multiple gaps
  var c3 = nv.checkContinuity([1, 4]);
  ctx.assert(c3.gaps.length === 2, 'two gaps');
  ctx.assert(c3.gaps[0] === 2 && c3.gaps[1] === 3, 'gaps are 2,3');

  // checkContinuity — single
  var c4 = nv.checkContinuity([1]);
  ctx.assert(c4.ok === true, 'single number ok');

  // checkContinuity — empty
  var c5 = nv.checkContinuity([]);
  ctx.assert(c5.ok === true, 'empty ok');

  // validateAllNumbering — all continuous
  var v1 = nv.validateAllNumbering('Table 1, Table 2, Figure 1, Figure 2.');
  ctx.assert(v1.ok === true, 'all continuous ok');
  ctx.assert(v1.issues.length === 0, 'no issues');

  // validateAllNumbering — table gap
  var v2 = nv.validateAllNumbering('Table 1, Table 3, Figure 1.');
  ctx.assert(v2.issues.length > 0, 'table gap has issues');
  ctx.assert(v2.issues[0].message.indexOf('Table') !== -1, 'issue mentions Table');

  // validateAllNumbering — figure gap
  var v3 = nv.validateAllNumbering('Table 1, Figure 1, Figure 3.');
  ctx.assert(v3.issues.length > 0, 'figure gap has issues');
};
