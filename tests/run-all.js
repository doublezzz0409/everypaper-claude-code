#!/usr/bin/env node
/**
 * Test Runner for everypaper-claude-code
 *
 * Runs all test files and reports results.
 * Usage: node tests/run-all.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;

function createContext() {
  return {
    assert(condition, message) {
      totalTests++;
      if (condition) {
        passedTests++;
        console.log(`  ${GREEN}✓${RESET} ${message}`);
      } else {
        failedTests++;
        console.log(`  ${RED}✗${RESET} ${message}`);
      }
    },
    assertEqual(actual, expected, message) {
      totalTests++;
      if (actual === expected) {
        passedTests++;
        console.log(`  ${GREEN}✓${RESET} ${message}`);
      } else {
        failedTests++;
        console.log(`  ${RED}✗${RESET} ${message}`);
        console.log(`    Expected: ${JSON.stringify(expected)}`);
        console.log(`    Actual:   ${JSON.stringify(actual)}`);
      }
    },
    assertDeepEqual(actual, expected, message) {
      totalTests++;
      const match = JSON.stringify(actual) === JSON.stringify(expected);
      if (match) {
        passedTests++;
        console.log(`  ${GREEN}✓${RESET} ${message}`);
      } else {
        failedTests++;
        console.log(`  ${RED}✗${RESET} ${message}`);
        console.log(`    Expected: ${JSON.stringify(expected)}`);
        console.log(`    Actual:   ${JSON.stringify(actual)}`);
      }
    },
    skip(message) {
      skippedTests++;
      console.log(`  ${YELLOW}⊘${RESET} ${message} (skipped)`);
    }
  };
}

function discoverTests(dir) {
  const tests = [];
  if (!fs.existsSync(dir)) return tests;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      tests.push(fullPath);
    }
  }
  return tests.sort();
}

function runTestFile(filePath) {
  const relPath = path.relative(path.join(__dirname, '..'), filePath);
  console.log(`\n${BOLD}Running: ${relPath}${RESET}`);
  try {
    const testModule = require(filePath);
    if (typeof testModule === 'function') {
      const ctx = createContext();
      testModule(ctx);
    } else if (typeof testModule.run === 'function') {
      const ctx = createContext();
      testModule.run(ctx);
    } else {
      console.log(`  ${YELLOW}⊘${RESET} No test function exported (skipped)`);
      skippedTests++;
    }
  } catch (err) {
    console.log(`  ${RED}✗${RESET} Error loading test: ${err.message}`);
    failedTests++;
    totalTests++;
  }
}

function main() {
  console.log(`${BOLD}=== everypaper-claude-code Test Suite ===${RESET}\n`);
  const testsDir = __dirname;

  const libTests = discoverTests(path.join(testsDir, 'lib'));
  if (libTests.length > 0) {
    console.log(`${BOLD}--- Library Tests ---${RESET}`);
    libTests.forEach(runTestFile);
  }

  const hookTests = discoverTests(path.join(testsDir, 'hooks'));
  if (hookTests.length > 0) {
    console.log(`\n${BOLD}--- Hook Tests ---${RESET}`);
    hookTests.forEach(runTestFile);
  }

  console.log(`\n${BOLD}=== Results ===${RESET}`);
  console.log(`  Total:   ${totalTests}`);
  console.log(`  ${GREEN}Passed:  ${passedTests}${RESET}`);
  if (failedTests > 0) console.log(`  ${RED}Failed:  ${failedTests}${RESET}`);
  if (skippedTests > 0) console.log(`  ${YELLOW}Skipped: ${skippedTests}${RESET}`);

  if (failedTests > 0) {
    console.log(`\n${RED}${BOLD}TESTS FAILED${RESET}`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}${BOLD}ALL TESTS PASSED${RESET}`);
    process.exit(0);
  }
}

main();
