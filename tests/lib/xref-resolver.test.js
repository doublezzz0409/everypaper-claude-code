#!/usr/bin/env node
'use strict';

var xref = require('../../scripts/lib/xref-resolver');

module.exports = function(ctx) {
  ctx.assert(typeof xref.extractRefs === 'function', 'extractRefs exported');
  ctx.assert(typeof xref.checkForwardRefs === 'function', 'checkForwardRefs exported');
  ctx.assert(typeof xref.checkBackwardRefs === 'function', 'checkBackwardRefs exported');

  // extractRefs
  var refs = xref.extractRefs('See Table 1 and Figure 2, also Eq. (3).');
  ctx.assert(refs.length === 3, 'extracted 3 refs');
  ctx.assertEqual(refs[0].type, 'table', 'first is table');
  ctx.assertEqual(refs[0].number, 1, 'table number 1');
  ctx.assertEqual(refs[1].type, 'figure', 'second is figure');
  ctx.assertEqual(refs[1].number, 2, 'figure number 2');

  // extractRefs Chinese
  var refs2 = xref.extractRefs('见表1和图2。');
  ctx.assert(refs2.length === 2, 'extracted 2 Chinese refs');

  // extractRefs empty
  var refs3 = xref.extractRefs('');
  ctx.assert(refs3.length === 0, 'empty no refs');

  // checkForwardRefs — all exist
  var schema = {
    tables: [{ number: 1 }, { number: 2 }],
    figures: [{ number: 1 }]
  };
  var r1 = xref.checkForwardRefs('See Table 1 and Figure 1.', schema);
  ctx.assert(r1.ok === true, 'existing refs ok');

  // checkForwardRefs — missing table
  var r2 = xref.checkForwardRefs('See Table 5.', schema);
  ctx.assert(r2.ok === false, 'missing table not ok');
  ctx.assert(r2.issues[0].level === 'critical', 'missing table is critical');

  // checkForwardRefs — missing figure
  var r3 = xref.checkForwardRefs('See Figure 9.', schema);
  ctx.assert(r3.ok === false, 'missing figure not ok');

  // checkForwardRefs — no schema
  var r4 = xref.checkForwardRefs('See Table 1.', null);
  ctx.assert(r4.ok === true, 'no schema passes');

  // checkBackwardRefs — all cited
  var content = 'See Table 1, Table 2, and Figure 1.';
  var r5 = xref.checkBackwardRefs(schema, content);
  ctx.assert(r5.issues.length === 0, 'all cited no issues');

  // checkBackwardRefs — uncited table
  var r6 = xref.checkBackwardRefs(schema, 'See Table 1 only.');
  ctx.assert(r6.issues.length > 0, 'uncited table has issues');
};
