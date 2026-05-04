#!/usr/bin/env node
/**
 * SessionStart Hook — Load Paper Context
 *
 * Runs when a new Claude Code session starts in the everypaper project.
 * Scans papers/ directory, loads references, and reports current state.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadState, scanReferences, buildProgressSummary } = require('../lib/paper-state');

function run(rawInput) {
  try {
    const cwd = process.cwd();
    const output = [];

    output.push('[SessionStart] Paper project detected. Loading context...');

    // Scan papers directory
    const papersDir = path.join(cwd, 'papers');
    if (fs.existsSync(papersDir)) {
      const files = fs.readdirSync(papersDir);
      const pdfs = files.filter(f => f.endsWith('.pdf'));
      const hasRefs = files.includes('references.json');
      output.push(`[SessionStart] papers/: ${files.length} files (${pdfs.length} PDFs)`);
      if (hasRefs) {
        const refs = scanReferences();
        output.push(`[SessionStart] references.json: ${refs.length} entries`);
      } else {
        output.push(`[SessionStart] WARNING: references.json not found`);
      }
    } else {
      output.push(`[SessionStart] WARNING: papers/ directory not found. Create it before adding literature.`);
    }

    // Scan output directory
    const outputDir = path.join(cwd, 'output');
    if (fs.existsSync(outputDir)) {
      const sections = path.join(outputDir, 'sections');
      if (fs.existsSync(sections)) {
        const sectionFiles = fs.readdirSync(sections).filter(f => f.endsWith('.md'));
        output.push(`[SessionStart] output/sections/: ${sectionFiles.length} draft files`);
      }
    }

    // Load previous state
    const state = loadState();
    if (state.lastUpdated) {
      output.push(`[SessionStart] Last session: ${state.lastUpdated}`);
      output.push(`[SessionStart] Current section: ${state.currentSection || 'not set'}`);
      if ((state.pendingConfirmations || []).length > 0) {
        output.push(`[SessionStart] Pending confirmations: ${state.pendingConfirmations.length}`);
      }
    }

    process.stderr.write(output.join('\n') + '\n');
    return buildProgressSummary(state);
  } catch (err) {
    process.stderr.write(`[SessionStart] Error: ${err.message}\n`);
    return rawInput;
  }
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    const result = run(raw);
    process.stdout.write(result);
  });
}

module.exports = { run };
