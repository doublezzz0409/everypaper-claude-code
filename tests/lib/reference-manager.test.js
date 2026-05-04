#!/usr/bin/env node
/**
 * Tests for scripts/lib/reference-manager.js
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

module.exports = function(ctx) {
  const rm = require('../../scripts/lib/reference-manager');

  // parseBibtex
  const bibtex = `@article{smith2023test,
    author = {Smith, John and Doe, Jane},
    title = {Test Article},
    journal = {Journal of Tests},
    year = {2023},
    volume = {1},
    number = {2},
    pages = {10-20},
    doi = {10.1234/test}
  }`;

  const parsed = rm.parseBibtex(bibtex);
  ctx.assert(parsed !== null, 'parseBibtex parses valid bibtex');
  ctx.assertEqual(parsed.title, 'Test Article', 'parseBibtex extracts title');
  ctx.assertEqual(parsed.year, '2023', 'parseBibtex extracts year');
  ctx.assertEqual(parsed.doi, '10.1234/test', 'parseBibtex extracts doi');

  ctx.assertEqual(rm.parseBibtex(null), null, 'parseBibtex null returns null');
  ctx.assertEqual(rm.parseBibtex('invalid'), null, 'parseBibtex invalid returns null');

  // isValidDoi
  ctx.assert(rm.isValidDoi('10.1234/test') === true, 'isValidDoi valid doi');
  ctx.assert(rm.isValidDoi('10.12/test') === false, 'isValidDoi short doi');
  ctx.assert(rm.isValidDoi('') === false, 'isValidDoi empty');
  ctx.assert(rm.isValidDoi(null) === false, 'isValidDoi null');

  // formatAPA
  const ref1 = { authors: 'Smith, John', year: '2023', title: 'Test', journal: 'Journal', volume: '1', doi: '10.1234/test' };
  const apa = rm.formatAPA(ref1);
  ctx.assert(apa.includes('Smith'), 'formatAPA includes author');
  ctx.assert(apa.includes('2023'), 'formatAPA includes year');
  ctx.assert(apa.includes('Test'), 'formatAPA includes title');

  // formatMLA
  const mla = rm.formatMLA(ref1);
  ctx.assert(mla.includes('Smith'), 'formatMLA includes author');
  ctx.assert(mla.includes('"Test'), 'formatMLA includes quoted title');

  // formatChicago
  const chicago = rm.formatChicago(ref1);
  ctx.assert(chicago.includes('Smith'), 'formatChicago includes author');

  // formatCitation
  ctx.assertEqual(typeof rm.formatCitation(ref1, 'apa'), 'string', 'formatCitation apa');
  ctx.assertEqual(typeof rm.formatCitation(ref1, 'mla'), 'string', 'formatCitation mla');
  ctx.assertEqual(typeof rm.formatCitation(ref1, 'chicago'), 'string', 'formatCitation chicago');

  // generateRefId
  const id = rm.generateRefId({ authors: 'Smith, John', year: '2023', title: 'Test Article' });
  ctx.assert(id.includes('smith'), 'generateRefId includes author');
  ctx.assert(id.includes('2023'), 'generateRefId includes year');

  // findDuplicates
  const refs = [
    { id: '1', title: 'Test', doi: '10.1234/a' },
    { id: '2', title: 'Test', doi: '10.1234/a' },
    { id: '3', title: 'Other', doi: '10.1234/b' }
  ];
  const dups = rm.findDuplicates(refs);
  ctx.assert(dups.length > 0, 'findDuplicates finds duplicates');

  // searchReferences
  const searchResults = rm.searchReferences(refs, 'Test');
  ctx.assert(searchResults.length === 2, 'searchReferences finds matching');
  ctx.assert(rm.searchReferences(refs, 'nonexistent').length === 0, 'searchReferences empty for no match');

  // getStats
  const stats = rm.getStats(refs);
  ctx.assertEqual(stats.total, 3, 'getStats total');
  ctx.assertEqual(stats.withDoi, 3, 'getStats withDoi');

  // addReference with temp directory
  const tmpDir = path.join(os.tmpdir(), 'everypaper-refs-test-' + Date.now());
  const papersDir = path.join(tmpDir, 'papers');
  fs.mkdirSync(papersDir, { recursive: true });

  const result1 = rm.addReference(tmpDir, { title: 'New Paper', authors: 'Author', year: '2024', doi: '10.9999/new' });
  ctx.assert(result1.added === true, 'addReference adds new');

  const result2 = rm.addReference(tmpDir, { title: 'New Paper', authors: 'Author', year: '2024', doi: '10.9999/new' });
  ctx.assert(result2.added === false, 'addReference rejects duplicate');

  const loaded = rm.loadReferences(tmpDir);
  ctx.assert(loaded.length === 1, 'loadReferences loads saved refs');

  fs.rmSync(tmpDir, { recursive: true, force: true });
};
