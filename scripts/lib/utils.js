#!/usr/bin/env node
/**
 * Cross-platform utility functions for everypaper hooks and scripts
 * Works on Windows, macOS, and Linux
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Get the project root directory (where papers/ and output/ live)
 */
function getProjectDir() {
  return process.cwd();
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Get current timestamp in ISO format
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Ensure a directory exists (create if not)
 * @param {string} dirPath - Directory path to create
 * @returns {string} The directory path
 */
function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw new Error(`Failed to create directory '${dirPath}': ${err.message}`);
    }
  }
  return dirPath;
}

/**
 * Read a file safely, return null if not found or unreadable
 * @param {string} filePath - Path to read
 * @returns {string|null} File contents or null
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Read and parse a JSON file safely
 * @param {string} filePath - Path to JSON file
 * @returns {*} Parsed data or null
 */
function readJson(filePath) {
  const content = readFile(filePath);
  if (content === null) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write a file, creating parent directories if needed
 * @param {string} filePath - Path to write
 * @param {string} content - Content to write
 */
function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Append to a file, creating it if it doesn't exist
 * @param {string} filePath - Path to append to
 * @param {string} content - Content to append
 */
function appendFile(filePath, content) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.appendFileSync(filePath, content, 'utf8');
}

/**
 * Write JSON to a file with formatting
 * @param {string} filePath - Path to write
 * @param {*} data - Data to serialize
 */
function writeJson(filePath, data) {
  writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Log to stderr (visible in Claude Code hook output)
 * @param {string} hookName - Name of the hook for prefix
 * @param {string} message - Message to log
 */
function log(hookName, message) {
  process.stderr.write(`[${hookName}] ${message}\n`);
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to check
 * @returns {boolean}
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Get the papers directory path
 */
function getPapersDir() {
  return path.join(getProjectDir(), 'papers');
}

/**
 * Get the output directory path
 */
function getOutputDir() {
  return path.join(getProjectDir(), 'output');
}

/**
 * Get the audit directory path
 */
function getAuditDir() {
  return path.join(getOutputDir(), 'audit');
}

/**
 * Get the sessions directory path
 */
function getSessionsDir() {
  return path.join(getOutputDir(), 'sessions');
}

/**
 * Get the templates directory path
 */
function getTemplatesDir() {
  return path.join(getProjectDir(), 'templates');
}

/**
 * Safe JSON parse that returns a default value on failure
 * @param {string} text - JSON string
 * @param {*} defaultValue - Default value on parse failure
 * @returns {*}
 */
function safeJsonParse(text, defaultValue = null) {
  try {
    return JSON.parse(text);
  } catch {
    return defaultValue;
  }
}

/**
 * Truncate a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLen - Maximum length
 * @returns {string}
 */
function truncate(str, maxLen = 200) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

const isWindows = process.platform === 'win32';
const isMacOS = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

function getHomeDir() {
  const explicitHome = process.env.HOME || process.env.USERPROFILE;
  if (explicitHome && explicitHome.trim().length > 0) {
    return path.resolve(explicitHome);
  }
  return os.homedir();
}

function getClaudeDir() {
  return path.join(getHomeDir(), '.claude');
}

module.exports = {
  getProjectDir,
  getDateString,
  getTimestamp,
  ensureDir,
  readFile,
  readJson,
  writeFile,
  appendFile,
  writeJson,
  log,
  fileExists,
  getPapersDir,
  getOutputDir,
  getAuditDir,
  getSessionsDir,
  getTemplatesDir,
  safeJsonParse,
  truncate,
  isWindows,
  isMacOS,
  isLinux,
  getHomeDir,
  getClaudeDir
};
