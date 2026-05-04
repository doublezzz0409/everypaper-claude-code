#!/usr/bin/env node
'use strict';

module.exports = function(ctx) {
  const insp = require('../../scripts/lib/inspection');

  // Exports
  ctx.assert(typeof insp.normalizeFailureReason === 'function', 'normalizeFailureReason exported');
  ctx.assert(typeof insp.classifyAcademicDomain === 'function', 'classifyAcademicDomain exported');
  ctx.assert(typeof insp.groupFailures === 'function', 'groupFailures exported');
  ctx.assert(typeof insp.detectPatterns === 'function', 'detectPatterns exported');
  ctx.assert(typeof insp.generateReport === 'function', 'generateReport exported');
  ctx.assert(typeof insp.suggestAction === 'function', 'suggestAction exported');
  ctx.assert(typeof insp.inspect === 'function', 'inspect exported');
  ctx.assert(typeof insp.loadRunsFromAuditLog === 'function', 'loadRunsFromAuditLog exported');

  // Constants
  ctx.assert(insp.DEFAULT_FAILURE_THRESHOLD === 3, 'default threshold is 3');
  ctx.assert(insp.DEFAULT_WINDOW_SIZE === 50, 'default window is 50');

  // normalizeFailureReason
  ctx.assertEqual(insp.normalizeFailureReason(null), 'unknown', 'null reason → unknown');
  ctx.assertEqual(insp.normalizeFailureReason(''), 'unknown', 'empty reason → unknown');
  ctx.assertEqual(insp.normalizeFailureReason('  Some Error  '), 'some error', 'trims and lowercases');
  ctx.assert(
    insp.normalizeFailureReason('Error at 2024-01-15T10:30:00Z').includes('<timestamp>'),
    'strips ISO timestamps'
  );
  ctx.assert(
    insp.normalizeFailureReason('Error at /path/to/file.js').includes('<path>'),
    'strips file paths'
  );
  ctx.assert(
    insp.normalizeFailureReason('Error at C:' + String.fromCharCode(92) + 'Users' + String.fromCharCode(92) + 'test' + String.fromCharCode(92) + 'file.js').includes('<path>'),
    'strips Windows paths'
  );

  // classifyAcademicDomain
  ctx.assertEqual(insp.classifyAcademicDomain(null), null, 'null → null');
  ctx.assertEqual(insp.classifyAcademicDomain('bibtex parse error'), 'bibtex', 'bibtex domain');
  ctx.assertEqual(insp.classifyAcademicDomain('citation not found'), 'citation', 'citation domain');
  ctx.assertEqual(insp.classifyAcademicDomain('data.csv not found'), 'data', 'data domain');
  ctx.assertEqual(insp.classifyAcademicDomain('latex compilation failed'), 'latex', 'latex domain');
  ctx.assertEqual(insp.classifyAcademicDomain('python import error'), 'python', 'python domain');
  ctx.assertEqual(insp.classifyAcademicDomain('R package not found'), 'r_lang', 'r_lang domain');
  ctx.assertEqual(insp.classifyAcademicDomain('p-value significance'), 'stats', 'stats domain');
  ctx.assertEqual(insp.classifyAcademicDomain('pdf extraction failed'), 'pdf', 'pdf domain');
  ctx.assertEqual(insp.classifyAcademicDomain('timeout exceeded'), 'timeout', 'timeout domain');
  ctx.assertEqual(insp.classifyAcademicDomain('random noise'), null, 'unknown → null');

  // groupFailures
  const runs = [
    { skillId: 'Bash', outcome: 'failure', failureReason: 'timeout exceeded' },
    { skillId: 'Bash', outcome: 'failure', failureReason: 'timeout exceeded again' },
    { skillId: 'Bash', outcome: 'success', failureReason: null },
    { skillId: 'Write', outcome: 'failure', failureReason: 'permission denied' },
  ];
  const groups = insp.groupFailures(runs);
  ctx.assert(groups.size === 3, 'groups failures by skill+reason');
  ctx.assert(groups.has('Bash::timeout exceeded') || groups.has('Bash::timeout exceeded again'), 'Bash timeout group exists');

  // detectPatterns
  const manyRuns = [];
  for (let i = 0; i < 5; i++) {
    manyRuns.push({
      skillId: 'Bash',
      outcome: 'failure',
      failureReason: 'bibtex parse error',
      createdAt: `2024-01-${15 + i}T10:00:00Z`,
    });
  }
  const patterns = insp.detectPatterns(manyRuns);
  ctx.assert(patterns.length >= 1, 'detects recurring pattern');
  ctx.assert(patterns[0].count === 5, 'pattern count matches');
  ctx.assert(patterns[0].domain === 'bibtex', 'pattern domain classified');

  // detectPatterns with no patterns (below threshold)
  const fewRuns = [
    { skillId: 'Bash', outcome: 'failure', failureReason: 'timeout' },
    { skillId: 'Bash', outcome: 'failure', failureReason: 'timeout' },
  ];
  const noPatterns = insp.detectPatterns(fewRuns);
  ctx.assert(noPatterns.length === 0, 'below threshold → no patterns');

  // generateReport with no patterns
  const cleanReport = insp.generateReport([]);
  ctx.assertEqual(cleanReport.status, 'clean', 'clean status when no patterns');
  ctx.assert(cleanReport.summary.includes('No recurring'), 'clean summary');

  // generateReport with patterns
  const report = insp.generateReport(patterns);
  ctx.assertEqual(report.status, 'attention_needed', 'attention_needed when patterns found');
  ctx.assert(report.patternCount >= 1, 'report has pattern count');
  ctx.assert(report.totalFailures === 5, 'total failures counted');
  ctx.assert(report.domains.includes('bibtex'), 'domains included');

  // suggestAction
  const bibtexPattern = { normalizedReason: 'bibtex parse error', domain: 'bibtex', count: 5, versions: [] };
  ctx.assert(insp.suggestAction(bibtexPattern).includes('BibTeX'), 'bibtex suggestion');

  const citationPattern = { normalizedReason: 'citation not found', domain: 'citation', count: 3, versions: [] };
  ctx.assert(insp.suggestAction(citationPattern).includes('citation key'), 'citation suggestion');

  const dataPattern = { normalizedReason: 'data.csv not found', domain: 'data', count: 4, versions: [] };
  ctx.assert(insp.suggestAction(dataPattern).includes('data file'), 'data suggestion');

  const genericPattern = { normalizedReason: 'unknown error', domain: null, count: 3, versions: [] };
  ctx.assert(insp.suggestAction(genericPattern).includes('Investigate'), 'generic suggestion');

  // ACADEMIC_PATTERNS
  ctx.assert(typeof insp.ACADEMIC_PATTERNS === 'object', 'ACADEMIC_PATTERNS exported');
  ctx.assert(insp.ACADEMIC_PATTERNS.bibtex instanceof RegExp, 'bibtex pattern is RegExp');
};
