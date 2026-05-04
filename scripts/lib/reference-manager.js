#!/usr/bin/env node
/**
 * Reference Manager Library
 *
 * Manages academic references for paper writing:
 * - Load/save references.json
 * - BibTeX parsing
 * - Citation formatting (APA 7th, MLA 9th, Chicago 17th)
 * - DOI validation
 * - Reference deduplication
 * - Search and filter
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { readFile, writeJson, ensureDir } = require('./utils');

const REFS_FILE = 'papers/references.json';

/**
 * Load references from papers/references.json
 * @param {string} projectDir - Project root directory
 * @returns {Array} Array of reference objects
 */
function loadReferences(projectDir) {
  const refsPath = path.join(projectDir, REFS_FILE);
  const data = readFile(refsPath);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save references to papers/references.json
 * @param {string} projectDir - Project root directory
 * @param {Array} references - Array of reference objects
 */
function saveReferences(projectDir, references) {
  const refsPath = path.join(projectDir, REFS_FILE);
  ensureDir(path.dirname(refsPath));
  writeJson(refsPath, references);
}

/**
 * Generate a unique ID for a reference
 * @param {object} ref - Reference object
 * @returns {string} Generated ID
 */
function generateRefId(ref) {
  const author = (ref.authors || ref.author || 'unknown')
    .split(',')[0].trim().split(' ').pop().toLowerCase().replace(/[^a-z]/g, '');
  const year = ref.year || '0000';
  const title = (ref.title || '').split(/\s+/).slice(0, 2).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${author}${year}${title}`;
}

/**
 * Parse a BibTeX entry string into a reference object
 * @param {string} bibtex - BibTeX entry string
 * @returns {object|null} Parsed reference or null
 */
function parseBibtex(bibtex) {
  if (!bibtex || typeof bibtex !== 'string') return null;
  const typeMatch = bibtex.match(/^@(\w+)\s*\{([^,]*),/);
  if (!typeMatch) return null;
  const type = typeMatch[1].toLowerCase();
  const key = typeMatch[2].trim();
  const fields = {};
  const fieldPattern = /(\w+)\s*=\s*\{([^}]*)\}/g;
  let match;
  while ((match = fieldPattern.exec(bibtex)) !== null) {
    fields[match[1].toLowerCase()] = match[2].trim();
  }
  return {
    id: key, type, title: fields.title || '', authors: fields.author || fields.editor || '',
    year: fields.year || '', journal: fields.journal || fields.booktitle || '',
    volume: fields.volume || '', number: fields.number || '', pages: fields.pages || '',
    publisher: fields.publisher || '', doi: fields.doi || '', url: fields.url || '',
    isbn: fields.isbn || '', issn: fields.issn || '', abstract: fields.abstract || '',
    keywords: fields.keywords || '', bibtex: bibtex.trim()
  };
}

/**
 * Validate a DOI string
 * @param {string} doi - DOI to validate
 * @returns {boolean} True if DOI format is valid
 */
function isValidDoi(doi) {
  if (!doi || typeof doi !== 'string') return false;
  return /^10\.\d{4,}\/.+/.test(doi.trim());
}

/**
 * Format authors for APA style
 */
function formatAuthorsAPA(authors) {
  if (!authors) return 'Unknown Author';
  const list = authors.split(/\s+and\s+|\s*,\s*/);
  if (list.length === 1) return list[0].trim();
  if (list.length === 2) return `${list[0].trim()} & ${list[1].trim()}`;
  if (list.length <= 20) {
    const last = list.pop();
    return `${list.map(a => a.trim()).join(', ')}, & ${last.trim()}`;
  }
  return `${list.slice(0, 19).map(a => a.trim()).join(', ')}, ... ${list[list.length - 1].trim()}`;
}

/**
 * Format a reference in APA 7th edition style
 */
function formatAPA(ref) {
  const authors = formatAuthorsAPA(ref.authors || ref.author || '');
  const year = ref.year || 'n.d.';
  const title = ref.title || 'Untitled';
  const journal = ref.journal || ref.booktitle || '';
  let citation = `${authors} (${year}). ${title}.`;
  if (journal) {
    citation += ` *${journal}*`;
    if (ref.volume) citation += `, *${ref.volume}*`;
    if (ref.number) citation += `(${ref.number})`;
    if (ref.pages) citation += `, ${ref.pages}`;
    citation += '.';
  }
  if (ref.doi) citation += ` https://doi.org/${ref.doi}`;
  return citation;
}

/**
 * Format authors for MLA style
 */
function formatAuthorsMLA(authors) {
  if (!authors) return 'Unknown Author';
  const list = authors.split(/\s+and\s+|\s*,\s*/);
  if (list.length === 1) return list[0].trim();
  if (list.length === 2) return `${list[0].trim()}, and ${list[1].trim()}`;
  return `${list[0].trim()}, et al.`;
}

/**
 * Format a reference in MLA 9th edition style
 */
function formatMLA(ref) {
  const authors = formatAuthorsMLA(ref.authors || ref.author || '');
  const title = ref.title || 'Untitled';
  const journal = ref.journal || ref.booktitle || '';
  let citation = `${authors}. "${title}."`;
  if (journal) {
    citation += ` *${journal}*`;
    if (ref.volume) citation += `, vol. ${ref.volume}`;
    if (ref.number) citation += `, no. ${ref.number}`;
    if (ref.year) citation += `, ${ref.year}`;
    if (ref.pages) citation += `, pp. ${ref.pages}`;
    citation += '.';
  }
  if (ref.doi) citation += ` DOI: ${ref.doi}.`;
  return citation;
}

/**
 * Format authors for Chicago style
 */
function formatAuthorsChicago(authors) {
  if (!authors) return 'Unknown Author';
  const list = authors.split(/\s+and\s+|\s*,\s*/);
  if (list.length === 1) return list[0].trim();
  if (list.length === 2) return `${list[0].trim()} and ${list[1].trim()}`;
  if (list.length === 3) return `${list[0].trim()}, ${list[1].trim()}, and ${list[2].trim()}`;
  return `${list[0].trim()} et al.`;
}

/**
 * Format a reference in Chicago 17th edition style
 */
function formatChicago(ref) {
  const authors = formatAuthorsChicago(ref.authors || ref.author || '');
  const title = ref.title || 'Untitled';
  const journal = ref.journal || ref.booktitle || '';
  let citation = `${authors}. "${title}."`;
  if (journal) {
    citation += ` *${journal}*`;
    if (ref.volume) citation += ` ${ref.volume}`;
    if (ref.number) citation += `, no. ${ref.number}`;
    if (ref.year) citation += ` (${ref.year})`;
    if (ref.pages) citation += `: ${ref.pages}`;
    citation += '.';
  }
  if (ref.doi) citation += ` https://doi.org/${ref.doi}.`;
  return citation;
}

/**
 * Format a reference in the specified style
 * @param {object} ref - Reference object
 * @param {string} style - Citation style: 'apa', 'mla', 'chicago'
 * @returns {string} Formatted citation
 */
function formatCitation(ref, style = 'apa') {
  switch (style.toLowerCase()) {
    case 'mla': return formatMLA(ref);
    case 'chicago': return formatChicago(ref);
    case 'apa':
    default: return formatAPA(ref);
  }
}

/**
 * Find duplicate references by DOI or title similarity
 * @param {Array} references - Array of reference objects
 * @returns {Array} Array of duplicate groups
 */
function findDuplicates(references) {
  const groups = [];
  const doiGroups = {};
  references.forEach((ref, idx) => {
    if (ref.doi) {
      const doi = ref.doi.toLowerCase().trim();
      if (!doiGroups[doi]) doiGroups[doi] = [];
      doiGroups[doi].push({ ref, idx });
    }
  });
  Object.values(doiGroups).forEach(group => {
    if (group.length > 1) groups.push({ type: 'doi', matches: group });
  });
  const titleGroups = {};
  references.forEach((ref, idx) => {
    if (ref.title) {
      const normalized = ref.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalized.length > 10) {
        if (!titleGroups[normalized]) titleGroups[normalized] = [];
        titleGroups[normalized].push({ ref, idx });
      }
    }
  });
  Object.values(titleGroups).forEach(group => {
    if (group.length > 1) {
      const alreadyGrouped = groups.some(g => g.matches.some(m => group.some(g2 => g2.idx === m.idx)));
      if (!alreadyGrouped) groups.push({ type: 'title', matches: group });
    }
  });
  return groups;
}

/**
 * Search references by keyword
 * @param {Array} references - Array of reference objects
 * @param {string} keyword - Search keyword
 * @returns {Array} Matching references
 */
function searchReferences(references, keyword) {
  if (!keyword) return references;
  const lower = keyword.toLowerCase();
  return references.filter(ref => {
    const searchable = [ref.title, ref.authors, ref.author, ref.journal, ref.abstract, ref.keywords, ref.year, ref.doi].filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(lower);
  });
}

/**
 * Add a reference, checking for duplicates
 * @param {string} projectDir - Project root directory
 * @param {object} newRef - Reference to add
 * @returns {{ added: boolean, ref: object, reason?: string }}
 */
function addReference(projectDir, newRef) {
  const refs = loadReferences(projectDir);
  if (newRef.doi) {
    const existing = refs.find(r => r.doi && r.doi.toLowerCase() === newRef.doi.toLowerCase());
    if (existing) return { added: false, ref: existing, reason: 'Duplicate DOI' };
  }
  if (newRef.title) {
    const normalized = newRef.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = refs.find(r => r.title && r.title.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized);
    if (existing) return { added: false, ref: existing, reason: 'Duplicate title' };
  }
  if (!newRef.id) newRef.id = generateRefId(newRef);
  refs.push(newRef);
  saveReferences(projectDir, refs);
  return { added: true, ref: newRef };
}

/**
 * Get reference statistics
 * @param {Array} references - Array of reference objects
 * @returns {object} Statistics
 */
function getStats(references) {
  const years = references.map(r => parseInt(r.year)).filter(y => !isNaN(y));
  const types = {};
  references.forEach(r => { const t = r.type || 'unknown'; types[t] = (types[t] || 0) + 1; });
  return {
    total: references.length,
    withDoi: references.filter(r => r.doi).length,
    withBibtex: references.filter(r => r.bibtex).length,
    yearRange: years.length > 0 ? { min: Math.min(...years), max: Math.max(...years) } : null,
    types
  };
}

module.exports = {
  loadReferences, saveReferences, generateRefId, parseBibtex, isValidDoi,
  formatCitation, formatAPA, formatMLA, formatChicago,
  findDuplicates, searchReferences, addReference, getStats
};
