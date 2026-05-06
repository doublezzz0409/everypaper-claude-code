#!/usr/bin/env node
/**
 * Paper Schema — Structured Intermediate Representation
 *
 * Manages output/paper-schema.json: the central state file for the format pipeline.
 * Tracks sections, tables, figures, citation style, and cross-references.
 */

'use strict';

var path = require('path');
var utils = require('./utils');

var SCHEMA_FILE = function() { return path.join(utils.getOutputDir(), 'paper-schema.json'); };

function loadSchema() {
  return utils.readJson(SCHEMA_FILE());
}

function saveSchema(schema) {
  utils.ensureDir(path.dirname(SCHEMA_FILE()));
  utils.writeJson(SCHEMA_FILE(), schema);
}

function createSchema(meta) {
  var now = utils.getTimestamp();
  var schema = {
    version: 1,
    created: now,
    updated: now,
    meta: {
      title: (meta && meta.title) || '',
      authors: (meta && meta.authors) || [],
      abstract: { content: ((meta && meta.abstract) || {}).content || '', wordCount: 0 },
      keywords: (meta && meta.keywords) || []
    },
    citationStyle: 'apa',
    sections: [],
    tables: [],
    figures: [],
    crossRefs: {}
  };
  saveSchema(schema);
  return schema;
}

function addSection(schema, section) {
  schema.updated = utils.getTimestamp();
  schema.sections.push({
    id: section.id,
    type: section.type || 'unknown',
    title: section.title || '',
    level: section.level || 1,
    file: section.file || '',
    status: section.status || 'drafted',
    formatOk: null,
    formatIssues: [],
    lastChecked: null
  });
  return schema;
}

function updateSection(schema, sectionId, updates) {
  for (var i = 0; i < schema.sections.length; i++) {
    if (schema.sections[i].id === sectionId) {
      schema.updated = utils.getTimestamp();
      var keys = Object.keys(updates);
      for (var k = 0; k < keys.length; k++) {
        schema.sections[i][keys[k]] = updates[keys[k]];
      }
      break;
    }
  }
  return schema;
}

function addTable(schema, table) {
  schema.updated = utils.getTimestamp();
  schema.tables.push({
    id: table.id,
    number: table.number,
    title: table.title || '',
    file: table.file || '',
    data_source: table.data_source || '',
    style: table.style || 'three-line',
    status: table.status || 'drafted',
    formatOk: null,
    referencedIn: table.referencedIn || [],
    lastChecked: null
  });
  return schema;
}

function addFigure(schema, figure) {
  schema.updated = utils.getTimestamp();
  schema.figures.push({
    id: figure.id,
    number: figure.number,
    title: figure.title || '',
    spec: figure.spec || '',
    file: figure.file || '',
    status: figure.status || 'drafted',
    formatOk: null,
    referencedIn: figure.referencedIn || [],
    lastChecked: null
  });
  return schema;
}

function markStale(schema, id) {
  schema.updated = utils.getTimestamp();
  var collections = [schema.sections, schema.tables, schema.figures];
  for (var ci = 0; ci < collections.length; ci++) {
    for (var ii = 0; ii < collections[ci].length; ii++) {
      if (collections[ci][ii].id === id) {
        collections[ci][ii].formatOk = null;
        collections[ci][ii].lastChecked = null;
        return schema;
      }
    }
  }
  return schema;
}

function getStaleItems(schema) {
  var stale = [];
  var names = ['sections', 'tables', 'figures'];
  for (var ni = 0; ni < names.length; ni++) {
    var items = schema[names[ni]] || [];
    for (var ii = 0; ii < items.length; ii++) {
      if (items[ii].formatOk === null) {
        stale.push({ collection: names[ni], item: items[ii] });
      }
    }
  }
  return stale;
}

module.exports = {
  loadSchema: loadSchema,
  saveSchema: saveSchema,
  createSchema: createSchema,
  addSection: addSection,
  updateSection: updateSection,
  addTable: addTable,
  addFigure: addFigure,
  markStale: markStale,
  getStaleItems: getStaleItems
};
