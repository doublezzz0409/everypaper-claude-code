#!/usr/bin/env node
'use strict';

var path = require('path');
var fs = require('fs');
var os = require('os');

var paperSchema = require('../../scripts/lib/paper-schema');

module.exports = function(ctx) {
  ctx.assert(typeof paperSchema.loadSchema === 'function', 'loadSchema exported');
  ctx.assert(typeof paperSchema.saveSchema === 'function', 'saveSchema exported');
  ctx.assert(typeof paperSchema.createSchema === 'function', 'createSchema exported');
  ctx.assert(typeof paperSchema.addSection === 'function', 'addSection exported');
  ctx.assert(typeof paperSchema.updateSection === 'function', 'updateSection exported');
  ctx.assert(typeof paperSchema.addTable === 'function', 'addTable exported');
  ctx.assert(typeof paperSchema.addFigure === 'function', 'addFigure exported');
  ctx.assert(typeof paperSchema.markStale === 'function', 'markStale exported');
  ctx.assert(typeof paperSchema.getStaleItems === 'function', 'getStaleItems exported');

  var origCwd = process.cwd();
  var tmpDir = path.join(os.tmpdir(), 'everypaper-schema-test-' + Date.now());
  var outputDir = path.join(tmpDir, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  process.chdir(tmpDir);

  try {
    // loadSchema returns null when no file
    ctx.assert(paperSchema.loadSchema() === null, 'loadSchema returns null when no file');

    // createSchema
    var schema = paperSchema.createSchema({ title: 'Test Paper', authors: ['Zhang'] });
    ctx.assert(schema.version === 1, 'createSchema version 1');
    ctx.assertEqual(schema.meta.title, 'Test Paper', 'createSchema title');
    ctx.assertEqual(schema.meta.authors[0], 'Zhang', 'createSchema author');
    ctx.assert(schema.citationStyle === 'apa', 'default citation style apa');
    ctx.assert(Array.isArray(schema.sections), 'sections is array');
    ctx.assert(schema.sections.length === 0, 'sections empty initially');

    // loadSchema after create
    var loaded = paperSchema.loadSchema();
    ctx.assert(loaded !== null, 'loadSchema returns data after create');
    ctx.assertEqual(loaded.meta.title, 'Test Paper', 'loaded title matches');

    // addSection
    schema = paperSchema.addSection(schema, { id: 'sec-1', type: 'introduction', title: '1. Introduction' });
    ctx.assertEqual(schema.sections.length, 1, 'addSection adds one');
    ctx.assertEqual(schema.sections[0].type, 'introduction', 'section type');
    ctx.assertEqual(schema.sections[0].status, 'drafted', 'default status drafted');
    ctx.assert(schema.sections[0].formatOk === null, 'default formatOk null');

    // updateSection
    schema = paperSchema.updateSection(schema, 'sec-1', { status: 'reviewed', formatOk: true });
    ctx.assertEqual(schema.sections[0].status, 'reviewed', 'updateSection status');
    ctx.assert(schema.sections[0].formatOk === true, 'updateSection formatOk');

    // updateSection nonexistent
    schema = paperSchema.updateSection(schema, 'nonexistent', { status: 'final' });
    ctx.assertEqual(schema.sections[0].status, 'reviewed', 'nonexistent update no change');

    // addTable
    schema = paperSchema.addTable(schema, { id: 'tab-1', number: 1, title: 'Descriptive Stats' });
    ctx.assertEqual(schema.tables.length, 1, 'addTable adds one');
    ctx.assertEqual(schema.tables[0].number, 1, 'table number');
    ctx.assertEqual(schema.tables[0].style, 'three-line', 'default table style');

    // addFigure
    schema = paperSchema.addFigure(schema, { id: 'fig-1', number: 1, title: 'Scatter Plot' });
    ctx.assertEqual(schema.figures.length, 1, 'addFigure adds one');
    ctx.assertEqual(schema.figures[0].number, 1, 'figure number');

    // markStale
    schema.tables[0].formatOk = true;
    schema = paperSchema.markStale(schema, 'tab-1');
    ctx.assert(schema.tables[0].formatOk === null, 'markStale resets formatOk');

    // getStaleItems
    var stale = paperSchema.getStaleItems(schema);
    ctx.assert(stale.length >= 2, 'getStaleItems finds stale items');

  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
