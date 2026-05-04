#!/usr/bin/env node
/**
 * Tests for scripts/lib/utils.js
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

module.exports = function(ctx) {
  const utils = require('../../scripts/lib/utils');

  ctx.assert(typeof utils.getProjectDir() === 'string', 'getProjectDir returns string');
  ctx.assert(utils.getProjectDir().length > 0, 'getProjectDir is not empty');

  const dateStr = utils.getDateString();
  ctx.assert(/^\d{4}-\d{2}-\d{2}$/.test(dateStr), 'getDateString returns YYYY-MM-DD format');

  const ts = utils.getTimestamp();
  ctx.assert(ts.includes('T'), 'getTimestamp returns ISO format');

  const tmpDir = path.join(os.tmpdir(), 'everypaper-test-' + Date.now());
  utils.ensureDir(tmpDir);
  ctx.assert(fs.existsSync(tmpDir), 'ensureDir creates directory');
  fs.rmdirSync(tmpDir);

  const tmpFile = path.join(os.tmpdir(), 'everypaper-test-' + Date.now() + '.json');
  utils.writeFile(tmpFile, 'hello');
  ctx.assertEqual(utils.readFile(tmpFile), 'hello', 'writeFile + readFile roundtrip');

  utils.writeJson(tmpFile, { key: 'value' });
  const parsed = utils.readJson(tmpFile);
  ctx.assert(parsed && parsed.key === 'value', 'writeJson + readJson roundtrip');
  fs.unlinkSync(tmpFile);

  ctx.assertEqual(utils.readFile('/nonexistent/file.txt'), null, 'readFile returns null for missing');
  ctx.assertEqual(utils.readJson('/nonexistent/file.json'), null, 'readJson returns null for missing');

  const tmpAppend = path.join(os.tmpdir(), 'everypaper-append-' + Date.now() + '.txt');
  utils.appendFile(tmpAppend, 'line1\n');
  utils.appendFile(tmpAppend, 'line2\n');
  ctx.assertEqual(utils.readFile(tmpAppend), 'line1\nline2\n', 'appendFile appends correctly');
  fs.unlinkSync(tmpAppend);

  ctx.assert(utils.fileExists(__filename) === true, 'fileExists true for existing');
  ctx.assert(utils.fileExists('/nonexistent') === false, 'fileExists false for missing');

  ctx.assertDeepEqual(utils.safeJsonParse('{"a":1}', {}), { a: 1 }, 'safeJsonParse valid');
  ctx.assertEqual(utils.safeJsonParse('invalid', null), null, 'safeJsonParse invalid returns default');

  ctx.assertEqual(utils.truncate('hello', 3), 'hel...', 'truncate shortens');
  ctx.assertEqual(utils.truncate('hi', 10), 'hi', 'truncate keeps short');
  ctx.assertEqual(utils.truncate('', 5), '', 'truncate empty');
  ctx.assertEqual(utils.truncate(null, 5), '', 'truncate null');

  ctx.assert(utils.getPapersDir().includes('papers'), 'getPapersDir');
  ctx.assert(utils.getOutputDir().includes('output'), 'getOutputDir');
  ctx.assert(utils.getAuditDir().includes('audit'), 'getAuditDir');
  ctx.assert(utils.getSessionsDir().includes('sessions'), 'getSessionsDir');
  ctx.assert(utils.getTemplatesDir().includes('templates'), 'getTemplatesDir');
};
