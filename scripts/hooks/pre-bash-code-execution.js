#!/usr/bin/env node
/**
 * PreToolUse:Bash Hook — Force Code Execution
 *
 * Detects numerical calculations and warns if not using Python/R.
 */

'use strict';

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const command = data.command || data.tool_input?.command || '';

    const mathPatterns = [
      /\d+\s*[+\-*/]\s*\d+/,
      /计算|compute|calculate/i,
      /均值|mean|average/i,
      /标准差|std|standard deviation/i,
      /回归|regression/i,
      /相关系数|correlation/i
    ];

    const hasMath = mathPatterns.some(p => p.test(command));

    if (hasMath) {
      const codePatterns = [
        /python|python3/i,
        /Rscript/i,
        /jupyter/i,
        /pandas|numpy|scipy|statsmodels/i,
        /import\s+pandas|import\s+numpy/i
      ];

      const usesCode = codePatterns.some(p => p.test(command));

      if (!usesCode) {
        process.stderr.write('[PreToolUse] WARNING: Numerical calculation detected. Use Python/R code execution.\n');
        process.stderr.write('[PreToolUse] Tip: Use python -c "..." or create a .py file.\n');
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
