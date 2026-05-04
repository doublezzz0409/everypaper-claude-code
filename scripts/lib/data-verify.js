#!/usr/bin/env node
/**
 * Data Verification Pipeline
 *
 * Validates data analysis outputs for paper writing:
 * - Check if calculations use code execution
 * - Validate statistical output formats
 * - Detect common issues (p-hacking, missing N, wrong rounding)
 * - Check data completeness
 */

'use strict';

/**
 * Check if a bash command uses code for numerical computation
 * @param {string} command - Bash command string
 * @returns {{ usesCode: boolean, warnings: string[] }}
 */
function checkCodeExecution(command) {
  const warnings = [];
  if (!command || typeof command !== 'string') return { usesCode: true, warnings };

  const mathPatterns = [
    /\d+\s*[+\-*/]\s*\d+/,
    /计算|compute|calculate/i,
    /均值|mean|average/i,
    /标准差|std|standard deviation/i,
    /回归|regression/i,
    /相关系数|correlation/i,
    /方差|variance/i,
    /中位数|median/i,
    /t检验|t-test|z检验|z-test|chi.?square/i,
    /p[.\s-]?value/i
  ];

  const hasMath = mathPatterns.some(p => p.test(command));
  if (!hasMath) return { usesCode: true, warnings };

  const codePatterns = [
    /python|python3/i, /Rscript/i, /jupyter/i,
    /pandas|numpy|scipy|statsmodels/i, /import\s+(pandas|numpy|scipy)/i,
    /library\(|require\(/i, /ggplot|dplyr|tidyverse/i,
    /stata|sas|spss/i, /matlab/i
  ];

  const usesCode = codePatterns.some(p => p.test(command));
  if (!usesCode) {
    warnings.push('Numerical calculation detected without code execution. Use Python/R/Stata.');
  }

  return { usesCode, warnings };
}

/**
 * Validate a statistical result object
 * @param {object} result - Statistical result
 * @returns {{ valid: boolean, warnings: string[] }}
 */
function validateStatResult(result) {
  const warnings = [];
  if (!result || typeof result !== 'object') return { valid: true, warnings };

  if (result.p_value !== undefined) {
    const p = parseFloat(result.p_value);
    if (isNaN(p) || p < 0 || p > 1) {
      warnings.push(`Invalid p-value: ${result.p_value}`);
    }
    if (p > 0.04 && p < 0.05) {
      warnings.push('Borderline p-value (0.04 < p < 0.05). Consider reporting exact p.');
    }
  }

  if (result.coefficient !== undefined) {
    const coef = parseFloat(result.coefficient);
    if (isNaN(coef)) {
      warnings.push(`Invalid coefficient: ${result.coefficient}`);
    }
    if (Math.abs(coef) > 100) {
      warnings.push(`Unusually large coefficient: ${coef}. Verify scale.`);
    }
  }

  if (result.r_squared !== undefined) {
    const r2 = parseFloat(result.r_squared);
    if (isNaN(r2) || r2 < 0 || r2 > 1) {
      warnings.push(`Invalid R-squared: ${result.r_squared}`);
    }
  }

  if (result.n !== undefined) {
    const n = parseInt(result.n);
    if (isNaN(n) || n <= 0) {
      warnings.push(`Invalid sample size: ${result.n}`);
    }
    if (n < 30) {
      warnings.push(`Small sample size (N=${n}). Results may be unreliable.`);
    }
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Check content for common statistical reporting issues
 * @param {string} content - Written content to check
 * @returns {{ issues: string[], suggestions: string[] }}
 */
function checkStatisticalReporting(content) {
  const issues = [];
  const suggestions = [];

  if (!content || typeof content !== 'string') return { issues, suggestions };

  const hasPValue = /p\s*[<>=]\s*\.?\d/i.test(content);
  const hasN = /\b[Nn]\s*=\s*\d+/.test(content) || /样本量|sample\s+size/i.test(content);
  if (hasPValue && !hasN) {
    issues.push('P-value reported without sample size (N). Always report N.');
  }

  const hasPercent = /\d+(\.\d+)?%/.test(content);
  if (hasPercent && !hasN) {
    suggestions.push('Percentage reported without sample size. Consider adding N.');
  }

  const hasSignificant = /显著|significant/i.test(content);
  if (hasSignificant && !hasPValue) {
    issues.push('"Significant" mentioned without p-value. Always report exact p.');
  }

  const hasCorrelation = /相关系数|correlation|r\s*=\s*\.?\d/i.test(content);
  const hasCI = /置信区间|confidence\s+interval|CI|95%/i.test(content);
  if (hasCorrelation && !hasCI) {
    suggestions.push('Correlation reported without confidence interval. Consider adding 95% CI.');
  }

  const hasRegression = /回归|regression|coefficient|系数/i.test(content);
  const hasR2 = /[Rr]-?squared|R²|R2/i.test(content);
  if (hasRegression && !hasR2) {
    suggestions.push('Regression results without R-squared. Consider reporting model fit.');
  }

  const testCount = (content.match(/p\s*[<>=]\s*\.?\d/gi) || []).length;
  if (testCount > 3) {
    const hasCorrection = /Bonferroni|FDR|Holm|校正|correction|adjust/i.test(content);
    if (!hasCorrection) {
      issues.push(`Multiple statistical tests (${testCount}) without correction. Consider Bonferroni/FDR.`);
    }
  }

  return { issues, suggestions };
}

/**
 * Validate a data file path for common issues
 * @param {string} filePath - Path to data file
 * @returns {{ valid: boolean, warnings: string[] }}
 */
function validateDataFile(filePath) {
  const warnings = [];
  if (!filePath || typeof filePath !== 'string') return { valid: true, warnings };

  const ext = filePath.toLowerCase().split('.').pop();
  const validExtensions = ['csv', 'xlsx', 'xls', 'dta', 'sav', 'sas', 'parquet', 'feather', 'json', 'tsv'];

  if (!validExtensions.includes(ext)) {
    warnings.push(`Uncommon data file extension: .${ext}. Verify format.`);
  }

  if (filePath.includes('~$') || filePath.includes('.tmp') || filePath.includes('.bak')) {
    warnings.push('File appears to be a temp/backup file. Use the original.');
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Generate a data verification report
 * @param {object} params - Parameters
 * @returns {object} Verification report
 */
function generateReport(params) {
  const { command, content, result, filePath } = params;
  const report = { passed: true, warnings: [], suggestions: [] };

  if (command) {
    const codeCheck = checkCodeExecution(command);
    if (!codeCheck.usesCode) report.passed = false;
    report.warnings.push(...codeCheck.warnings);
  }

  if (result) {
    const statCheck = validateStatResult(result);
    report.warnings.push(...statCheck.warnings);
  }

  if (content) {
    const reportCheck = checkStatisticalReporting(content);
    report.warnings.push(...reportCheck.issues);
    report.suggestions.push(...reportCheck.suggestions);
    if (reportCheck.issues.length > 0) report.passed = false;
  }

  if (filePath) {
    const fileCheck = validateDataFile(filePath);
    report.warnings.push(...fileCheck.warnings);
  }

  return report;
}

module.exports = {
  checkCodeExecution,
  validateStatResult,
  checkStatisticalReporting,
  validateDataFile,
  generateReport
};
