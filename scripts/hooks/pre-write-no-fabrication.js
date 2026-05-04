#!/usr/bin/env node
/**
 * PreToolUse:Write|Edit Hook — Detect Fabrication
 *
 * Detects fabricated literature references, data, and formulas.
 */

'use strict';

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const content = data.content || data.tool_input?.content || '';

    const warnings = [];

    // Check for citations without source
    const citationMatches = content.match(/\([A-Z][a-z]+,\s*\d{4}\)/g);
    if (citationMatches) {
      const hasSource = content.includes('来源') || content.includes('source') ||
                        content.includes('DOI') || content.includes('papers/');
      if (!hasSource) {
        warnings.push('[PreToolUse] WARNING: Citation detected without source');
      }
    }

    // Check for data without source
    const dataMatches = content.match(/\d+\.\d{2,}/g);
    if (dataMatches && dataMatches.length > 3) {
      const hasSource = content.includes('来源') || content.includes('source') ||
                        content.includes('数据来源') || content.includes('papers/');
      if (!hasSource) {
        warnings.push('[PreToolUse] WARNING: Data detected without source');
      }
    }

    if (warnings.length > 0) {
      warnings.forEach(w => process.stderr.write(w + '\n'));
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
