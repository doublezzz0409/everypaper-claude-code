#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

module.exports = function(ctx) {
  const pd = require('../../scripts/lib/paper-detect');

  const tmpDir = path.join(os.tmpdir(), 'everypaper-detect-' + Date.now());
  fs.mkdirSync(path.join(tmpDir, 'papers'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '金融研究论文');
  fs.writeFileSync(path.join(tmpDir, 'papers', 'ref.bib'), '');

  const files = pd.scanFiles(tmpDir);
  ctx.assert(files.length > 0, 'scanFiles finds files');
  ctx.assert(files.some(f => f.includes('CLAUDE')), 'scanFiles includes CLAUDE.md');

  const paperType = pd.detectPaperType(tmpDir);
  ctx.assert(typeof paperType.type === 'string', 'detectPaperType returns type');
  ctx.assert(typeof paperType.confidence === 'number', 'detectPaperType returns confidence');

  const field = pd.detectResearchField(tmpDir);
  ctx.assert(typeof field.field === 'string', 'detectResearchField returns field');

  const style = pd.detectCitationStyle(tmpDir);
  ctx.assert(typeof style.style === 'string', 'detectCitationStyle returns style');

  const tools = pd.detectDataTools(tmpDir);
  ctx.assert(Array.isArray(tools), 'detectDataTools returns array');

  const project = pd.detectProject(tmpDir);
  ctx.assert(project.paperType !== undefined, 'detectProject has paperType');
  ctx.assert(project.researchField !== undefined, 'detectProject has researchField');
  ctx.assert(Array.isArray(project.dataTools), 'detectProject has dataTools array');

  ctx.assert(Array.isArray(pd.PAPER_TYPE_RULES), 'PAPER_TYPE_RULES exported');
  ctx.assert(Array.isArray(pd.FIELD_RULES), 'FIELD_RULES exported');

  fs.rmSync(tmpDir, { recursive: true, force: true });
};
