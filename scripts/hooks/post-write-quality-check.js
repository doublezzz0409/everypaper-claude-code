#!/usr/bin/env node
/**
 * PostToolUse:Write|Edit Hook — Quality Check
 *
 * Reviews written content for compliance with paper writing rules.
 */

'use strict';

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const content = data.content || data.tool_input?.content || '';

    const warnings = [];

    if (content.includes('编造') || content.includes('fabricat')) {
      warnings.push('[PostToolUse] WARNING: Content contains fabrication-related words');
    }

    const citationMatches = content.match(/\([A-Z][a-z]+,\s*\d{4}\)/g);
    if (citationMatches) {
      const hasSource = content.includes('来源') || content.includes('source') ||
                        content.includes('DOI') || content.includes('papers/');
      if (!hasSource) {
        warnings.push('[PostToolUse] WARNING: Citation without source annotation');
      }
    }

    const methodPatterns = [/回归|regression/i, /检验|test/i, /模型|model/i];
    const hasMethod = methodPatterns.some(p => p.test(content));
    if (hasMethod) {
      const hasSource = content.includes('来源') || content.includes('source') ||
                        content.includes('待人类确认') || content.includes('TODO');
      if (!hasSource) {
        warnings.push('[PostToolUse] WARNING: Method description without source annotation');
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
