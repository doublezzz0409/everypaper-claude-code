#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const osMod = require('os');

module.exports = function(ctx) {
  const prov = require('../../scripts/lib/skill-evolution/provenance');
  ctx.assert(typeof prov.SKILL_TYPES === 'object', 'SKILL_TYPES exported');
  ctx.assert(prov.SKILL_TYPES.CURATED === 'curated', 'CURATED type');
  ctx.assert(prov.SKILL_TYPES.LEARNED === 'learned', 'LEARNED type');
  ctx.assert(prov.SKILL_TYPES.IMPORTED === 'imported', 'IMPORTED type');
  ctx.assert(typeof prov.classifySkillPath === 'function', 'classifySkillPath exported');
  ctx.assert(typeof prov.validateProvenance === 'function', 'validateProvenance exported');
  ctx.assert(typeof prov.requiresProvenance === 'function', 'requiresProvenance exported');

  const validRecord = {
    source: 'session-abc',
    created_at: '2024-01-15T10:00:00Z',
    confidence: 0.8,
    author: 'user',
  };
  const validResult = prov.validateProvenance(validRecord);
  ctx.assert(validResult.valid === true, 'valid record passes');
  ctx.assert(validResult.errors.length === 0, 'no errors for valid record');

  const noSource = { created_at: '2024-01-15T10:00:00Z', confidence: 0.8, author: 'user' };
  const noSourceResult = prov.validateProvenance(noSource);
  ctx.assert(noSourceResult.valid === false, 'missing source fails');
  ctx.assert(noSourceResult.errors.some(e => e.includes('source')), 'source error message');

  const badConf = { source: 'test', created_at: '2024-01-15T10:00:00Z', confidence: 1.5, author: 'user' };
  const badConfResult = prov.validateProvenance(badConf);
  ctx.assert(badConfResult.valid === false, 'confidence > 1 fails');

  const nullResult = prov.validateProvenance(null);
  ctx.assert(nullResult.valid === false, 'null input fails');

  const noAuthor = { source: 'test', created_at: '2024-01-15T10:00:00Z', confidence: 0.5 };
  const noAuthorResult = prov.validateProvenance(noAuthor);
  ctx.assert(noAuthorResult.valid === false, 'missing author fails');

  const roots = prov.getSkillRoots({ repoRoot: '/repo', homeDir: '/home' });
  ctx.assert(roots.curated.endsWith('skills'), 'curated root ends with skills');
  ctx.assert(roots.learned.includes('learned'), 'learned root includes learned');
  ctx.assert(roots.imported.includes('imported'), 'imported root includes imported');

  const vers = require('../../scripts/lib/skill-evolution/versioning');
  ctx.assert(typeof vers.createVersion === 'function', 'createVersion exported');
  ctx.assert(typeof vers.listVersions === 'function', 'listVersions exported');
  ctx.assert(typeof vers.getCurrentVersion === 'function', 'getCurrentVersion exported');
  ctx.assert(typeof vers.rollbackTo === 'function', 'rollbackTo exported');
  ctx.assert(typeof vers.getEvolutionLog === 'function', 'getEvolutionLog exported');
  ctx.assert(Array.isArray(vers.EVOLUTION_LOG_TYPES), 'EVOLUTION_LOG_TYPES exported');
  ctx.assert(vers.EVOLUTION_LOG_TYPES.includes('amendments'), 'amendments log type exists');

  const origCwd = process.cwd();
  const tmpDir = path.join(osMod.tmpdir(), 'everypaper-version-test-' + Date.now());
  const skillDir = path.join(tmpDir, 'skills', 'test-skill');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill' + String.fromCharCode(10), 'utf8');

  try {
    const v1 = vers.createVersion(skillDir, { reason: 'initial', author: 'test' });
    ctx.assert(v1.version === 1, 'first version is 1');
    ctx.assert(fs.existsSync(v1.path), 'version snapshot exists');

    const versions = vers.listVersions(skillDir);
    ctx.assert(versions.length === 1, 'one version listed');
    ctx.assert(versions[0].version === 1, 'version number correct');

    ctx.assertEqual(vers.getCurrentVersion(skillDir), 1, 'current version is 1');

    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill v2' + String.fromCharCode(10), 'utf8');
    const v2 = vers.createVersion(skillDir, { reason: 'update', author: 'test' });
    ctx.assert(v2.version === 2, 'second version is 2');

    const evLog = vers.getEvolutionLog(skillDir, 'amendments');
    ctx.assert(evLog.length >= 2, 'evolution log has entries');
    ctx.assert(evLog[0].event === 'snapshot', 'first entry is snapshot');

    const rb = vers.rollbackTo(skillDir, 1, { reason: 'rollback test', author: 'test' });
    ctx.assert(rb.version === 3, 'rollback creates new version');
    const content = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    ctx.assert(content === '# Test Skill' + String.fromCharCode(10), 'content rolled back to v1');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const tracker = require('../../scripts/lib/skill-evolution/tracker');
  ctx.assert(typeof tracker.recordSkillExecution === 'function', 'recordSkillExecution exported');
  ctx.assert(typeof tracker.readSkillExecutionRecords === 'function', 'readSkillExecutionRecords exported');
  ctx.assert(typeof tracker.normalizeExecutionRecord === 'function', 'normalizeExecutionRecord exported');
  ctx.assert(tracker.VALID_OUTCOMES.has('success'), 'VALID_OUTCOMES has success');
  ctx.assert(tracker.VALID_FEEDBACK.has('accepted'), 'VALID_FEEDBACK has accepted');

  const record = tracker.normalizeExecutionRecord({
    skill_id: 'test-skill',
    skill_version: '1',
    task_description: 'test task',
    outcome: 'success',
  });
  ctx.assertEqual(record.skill_id, 'test-skill', 'skill_id normalized');
  ctx.assertEqual(record.outcome, 'success', 'outcome normalized');
  ctx.assert(record.recorded_at, 'recorded_at auto-filled');

  let threw = false;
  try { tracker.normalizeExecutionRecord({}); } catch (e) { threw = true; }
  ctx.assert(threw, 'throws on missing required fields');

  threw = false;
  try {
    tracker.normalizeExecutionRecord({
      skill_id: 'test', skill_version: '1', task_description: 'test', outcome: 'bad',
    });
  } catch (e) { threw = true; }
  ctx.assert(threw, 'throws on invalid outcome');

  const tmpRuns = path.join(osMod.tmpdir(), 'everypaper-runs-' + Date.now() + '.jsonl');
  try {
    const result = tracker.recordSkillExecution({
      skill_id: 'test-skill',
      skill_version: '1',
      task_description: 'test task',
      outcome: 'success',
    }, { runsFilePath: tmpRuns });
    ctx.assertEqual(result.storage, 'jsonl', 'storage is jsonl');
    ctx.assert(fs.existsSync(tmpRuns), 'runs file created');

    const records = tracker.readSkillExecutionRecords({ runsFilePath: tmpRuns });
    ctx.assert(records.length === 1, 'one record written');
    ctx.assertEqual(records[0].skill_id, 'test-skill', 'record has correct skill_id');
  } finally {
    if (fs.existsSync(tmpRuns)) fs.unlinkSync(tmpRuns);
  }
};
