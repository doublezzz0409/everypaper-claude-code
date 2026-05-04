#!/usr/bin/env node
'use strict';

module.exports = function(ctx) {
  const dv = require('../../scripts/lib/data-verify');

  // checkCodeExecution
  const r1 = dv.checkCodeExecution('python -c "print(1+1)"');
  ctx.assert(r1.usesCode === true, 'python command uses code');

  const r2 = dv.checkCodeExecution('echo 1+1');
  ctx.assert(r2.usesCode === false, 'echo without code');
  ctx.assert(r2.warnings.length > 0, 'echo produces warning');

  const r3 = dv.checkCodeExecution('ls -la');
  ctx.assert(r3.usesCode === true, 'non-math command passes');

  const r4 = dv.checkCodeExecution('Rscript analysis.R');
  ctx.assert(r4.usesCode === true, 'Rscript uses code');

  ctx.assert(dv.checkCodeExecution('').usesCode === true, 'empty passes');
  ctx.assert(dv.checkCodeExecution(null).usesCode === true, 'null passes');

  // validateStatResult
  ctx.assert(dv.validateStatResult({ p_value: 0.03, n: 100 }).valid === true, 'valid result');

  const v2 = dv.validateStatResult({ p_value: 1.5 });
  ctx.assert(v2.valid === false, 'invalid p-value');

  const v3 = dv.validateStatResult({ p_value: 0.045 });
  ctx.assert(v3.warnings.some(w => w.includes('Borderline')), 'borderline p-value');

  const v4 = dv.validateStatResult({ coefficient: 999 });
  ctx.assert(v4.warnings.some(w => w.includes('large')), 'large coefficient');

  ctx.assert(dv.validateStatResult({ r_squared: 1.5 }).valid === false, 'invalid R-squared');

  const v6 = dv.validateStatResult({ n: 10 });
  ctx.assert(v6.warnings.some(w => w.includes('Small')), 'small sample');

  ctx.assert(dv.validateStatResult(null).valid === true, 'null passes');

  // checkStatisticalReporting
  const s1 = dv.checkStatisticalReporting('p < 0.05, the result is significant.');
  ctx.assert(s1.issues.some(i => i.includes('sample size')), 'p without N');

  const s2 = dv.checkStatisticalReporting('The correlation is significant.');
  ctx.assert(s2.issues.some(i => i.includes('p-value')), 'significant without p');

  const s3 = dv.checkStatisticalReporting('r = 0.85, N = 100, p < 0.01');
  ctx.assert(s3.suggestions.some(s => s.includes('confidence')), 'correlation without CI');

  const s4 = dv.checkStatisticalReporting('p=0.01, p=0.02, p=0.03, p=0.04');
  ctx.assert(s4.issues.some(i => i.includes('correction')), 'multiple tests without correction');

  ctx.assert(dv.checkStatisticalReporting(null).issues.length === 0, 'null passes');

  // validateDataFile
  ctx.assert(dv.validateDataFile('data.csv').valid === true, 'csv valid');

  const f2 = dv.validateDataFile('data.xyz');
  ctx.assert(f2.warnings.some(w => w.includes('extension')), 'unusual extension');

  ctx.assert(dv.validateDataFile(null).valid === true, 'null passes');

  // generateReport
  const report = dv.generateReport({ command: 'python analysis.py', content: 'N=100, p<0.05' });
  ctx.assert(report.passed === true, 'code + complete reporting passes');
};
