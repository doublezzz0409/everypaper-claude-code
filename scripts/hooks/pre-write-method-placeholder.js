#!/usr/bin/env node
/**
 * PreToolUse:Write|Edit Hook — Method Placeholder Check
 *
 * Detects uncertain methods without [待人类确认] annotation.
 */

'use strict';

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const content = data.content || data.tool_input?.content || '';

    const methodPatterns = [
      /回归|regression/i,
      /检验|test/i,
      /模型|model/i,
      /分析|analysis/i,
      /估计|estimation/i
    ];

    const hasMethod = methodPatterns.some(p => p.test(content));

    if (hasMethod) {
      const placeholderPatterns = [
        /待人类确认/,
        /待确认/,
        /TODO/,
        /待补充/,
        /\[来源待确认\]/
      ];

      const hasPlaceholder = placeholderPatterns.some(p => p.test(content));

      if (!hasPlaceholder) {
        const hasSource = content.includes('来源') || content.includes('source') ||
                          content.includes('教科书') || content.includes('权威') ||
                          content.includes('DOI') || content.includes('papers/');

        if (!hasSource) {
          process.stderr.write('[PreToolUse] WARNING: Method description without source or placeholder\n');
          process.stderr.write('[PreToolUse] Tip: If uncertain, mark [待人类确认]\n');
          process.stderr.write('[PreToolUse] Tip: If certain, cite authoritative source\n');
        }
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
