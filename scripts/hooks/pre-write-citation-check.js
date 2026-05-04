#!/usr/bin/env node
/**
 * PreToolUse:Write|Edit Hook — Citation Check
 *
 * Checks that citations have sources available in papers/.
 */

'use strict';

const { getPapersDir, fileExists } = require('../lib/utils');

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const content = data.content || data.tool_input?.content || '';

    const citationPattern = /\([A-Z][a-z]+(?:\s+(?:et\s+al\.?|&\s+[A-Z][a-z]+))?,\s*\d{4}\)/g;
    const citations = content.match(citationPattern);

    if (citations && citations.length > 0) {
      const papersDir = getPapersDir();
      if (!fileExists(papersDir)) {
        process.stderr.write('[PreToolUse] WARNING: Citations detected but papers/ directory does not exist\n');
        process.stderr.write('[PreToolUse] Tip: Create papers/ directory and save literature first\n');
      } else if (!fileExists(`${papersDir}/references.json`)) {
        process.stderr.write('[PreToolUse] WARNING: Citations detected but papers/references.json does not exist\n');
        process.stderr.write('[PreToolUse] Tip: Create literature index first\n');
      }
    }

    return rawInput;
  } catch {
    return rawInput;
  }
}

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    const result = run(input);
    process.stdout.write(result);
  });
}

module.exports = { run };
