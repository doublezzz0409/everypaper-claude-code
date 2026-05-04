'use strict';

const fs = require('fs');
const { readFile, getAuditDir, log } = require('./utils');

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_WINDOW_SIZE = 50;

const FAILURE_OUTCOMES = new Set(['failure', 'failed', 'error']);

// Academic-specific failure reason patterns
const ACADEMIC_PATTERNS = {
  bibtex: /bibtex|bib\s*(?:parse|format|syntax)|@?\w+\{/,
  citation: /citation|cite|reference.*not.*found|missing.*ref/,
  data: /\.(csv|xlsx?|dta|sav|parquet)|data(?:base)?.*(?:not found|missing|corrupt)/,
  latex: /latex|\.tex|compil|pdflatex|xelatex/,
  python: /python|pip|import.*error|module.*not.*found|conda/,
  r_lang: /\br\b.*error|rstudio|rscript|package.*not.*found/,
  stats: /p[- ]?value|regression|correlation|anova|t[- ]?test|significance/,
  pdf: /\.pdf|pdf.*extract|ocr|pdfplumber/,
  timeout: /timeout|timed?\s*out|deadline|exceeded/,
  permission: /permission|denied|access|forbidden|auth/,
  parse: /parse|syntax|json.*error|yaml.*error|malformed/,
  not_found: /not\s*found|missing|no\s*such\s*file|enoent/,
};

/**
 * Normalize a failure reason string for grouping.
 * Strips timestamps, UUIDs, file paths, and numeric suffixes.
 */
function normalizeFailureReason(reason) {
  if (!reason || typeof reason !== 'string') {
    return 'unknown';
  }

  return reason
    .trim()
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}[.\dz]*/g, '<timestamp>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>')
    .replace(/\/[\w./-]+/g, '<path>')
    .replace(/[a-z]:\\[\w\\.-]+/gi, '<path>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect which academic domain a failure reason belongs to.
 */
function classifyAcademicDomain(reason) {
  if (!reason || typeof reason !== 'string') return null;

  const lower = reason.toLowerCase();
  for (const [domain, pattern] of Object.entries(ACADEMIC_PATTERNS)) {
    if (pattern.test(lower)) return domain;
  }
  return null;
}

/**
 * Group skill runs by skill ID and normalized failure reason.
 */
function groupFailures(skillRuns) {
  const groups = new Map();

  for (const run of skillRuns) {
    const outcome = String(run.outcome || '').toLowerCase();
    if (!FAILURE_OUTCOMES.has(outcome)) {
      continue;
    }

    const normalizedReason = normalizeFailureReason(run.failureReason || run.failure_reason);
    const key = `${run.skillId || run.skill_id || 'unknown'}::${normalizedReason}`;

    if (!groups.has(key)) {
      groups.set(key, {
        skillId: run.skillId || run.skill_id || 'unknown',
        normalizedReason,
        runs: [],
      });
    }

    groups.get(key).runs.push(run);
  }

  return groups;
}

/**
 * Detect recurring failure patterns from skill runs.
 */
function detectPatterns(skillRuns, options = {}) {
  const threshold = options.threshold ?? DEFAULT_FAILURE_THRESHOLD;
  const groups = groupFailures(skillRuns);
  const patterns = [];

  for (const [, group] of groups) {
    if (group.runs.length < threshold) {
      continue;
    }

    const sortedRuns = [...group.runs].sort(
      (a, b) => (b.createdAt || b.recorded_at || '').localeCompare(a.createdAt || a.recorded_at || '')
    );

    const firstSeen = sortedRuns[sortedRuns.length - 1].createdAt || sortedRuns[sortedRuns.length - 1].recorded_at || null;
    const lastSeen = sortedRuns[0].createdAt || sortedRuns[0].recorded_at || null;
    const rawReasons = [...new Set(sortedRuns.map(r => r.failureReason || r.failure_reason).filter(Boolean))];
    const domain = classifyAcademicDomain(group.normalizedReason);

    patterns.push({
      skillId: group.skillId,
      normalizedReason: group.normalizedReason,
      domain,
      count: group.runs.length,
      firstSeen,
      lastSeen,
      rawReasons,
    });
  }

  return patterns.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return (b.lastSeen || '').localeCompare(a.lastSeen || '');
  });
}

/**
 * Suggest a remediation action based on pattern characteristics.
 */
function suggestAction(pattern) {
  const reason = pattern.normalizedReason;
  const domain = pattern.domain;

  if (domain === 'bibtex') {
    return 'Check BibTeX format: ensure @type{key, ...} syntax, matching braces, and required fields.';
  }
  if (domain === 'citation') {
    return 'Verify citation key exists in references.bib/references.json. Check for typos in \\cite{} commands.';
  }
  if (domain === 'data') {
    return 'Verify data file exists in papers/ or data/. Check file format and encoding (UTF-8 recommended).';
  }
  if (domain === 'latex') {
    return 'Check LaTeX compilation: ensure packages are installed, .tex syntax is valid, and bibtex runs correctly.';
  }
  if (domain === 'python') {
    return 'Check Python environment: verify packages installed, Python path correct, and script syntax valid.';
  }
  if (domain === 'r_lang') {
    return 'Check R environment: verify packages installed, R path correct, and script syntax valid.';
  }
  if (domain === 'stats') {
    return 'Review statistical method: verify assumptions met, sample size adequate, and correct test selected.';
  }
  if (domain === 'pdf') {
    return 'Check PDF extraction: verify file exists, not corrupted, and use appropriate extraction tool.';
  }

  if (reason.includes('timeout')) {
    return 'Increase timeout or break operation into smaller steps.';
  }
  if (reason.includes('permission') || reason.includes('denied') || reason.includes('auth')) {
    return 'Check file permissions and tool access configuration.';
  }
  if (reason.includes('not found') || reason.includes('missing')) {
    return 'Verify required files and dependencies exist before execution.';
  }
  if (reason.includes('parse') || reason.includes('syntax')) {
    return 'Review input format expectations and add validation.';
  }

  return 'Investigate root cause. Check audit log for details.';
}

/**
 * Generate an inspection report from detected patterns.
 */
function generateReport(patterns, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();

  if (patterns.length === 0) {
    return {
      generatedAt,
      status: 'clean',
      patternCount: 0,
      patterns: [],
      summary: 'No recurring failure patterns detected.',
    };
  }

  const totalFailures = patterns.reduce((sum, p) => sum + p.count, 0);
  const affectedSkills = [...new Set(patterns.map(p => p.skillId))];
  const domains = [...new Set(patterns.map(p => p.domain).filter(Boolean))];

  return {
    generatedAt,
    status: 'attention_needed',
    patternCount: patterns.length,
    totalFailures,
    affectedSkills,
    domains,
    patterns: patterns.map(p => ({
      skillId: p.skillId,
      normalizedReason: p.normalizedReason,
      domain: p.domain,
      count: p.count,
      firstSeen: p.firstSeen,
      lastSeen: p.lastSeen,
      rawReasons: p.rawReasons.slice(0, 5),
      suggestedAction: suggestAction(p),
    })),
    summary: `Found ${patterns.length} recurring failure pattern(s) across ${affectedSkills.length} skill(s) (${totalFailures} total failures).${domains.length > 0 ? ` Domains: ${domains.join(', ')}.` : ''}`,
  };
}

/**
 * Load skill runs from audit log files.
 */
function loadRunsFromAuditLog(options = {}) {
  const windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;
  const auditDir = getAuditDir();

  if (!fs.existsSync(auditDir)) return [];

  const logFiles = fs.readdirSync(auditDir)
    .filter(f => f.endsWith('.jsonl'))
    .sort()
    .reverse()
    .slice(0, 5);

  const runs = [];
  for (const file of logFiles) {
    const content = readFile(`${auditDir}/${file}`);
    if (!content) continue;

    const lines = content.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.tool && entry.error) {
          runs.push({
            skillId: entry.tool,
            outcome: 'failure',
            failureReason: entry.error,
            createdAt: entry.timestamp || entry.ts,
          });
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  return runs.slice(-windowSize);
}

/**
 * Run full inspection pipeline.
 */
function inspect(options = {}) {
  const threshold = options.threshold ?? DEFAULT_FAILURE_THRESHOLD;
  const skillRuns = options.skillRuns || loadRunsFromAuditLog(options);

  const patterns = detectPatterns(skillRuns, { threshold });
  return generateReport(patterns, { generatedAt: new Date().toISOString() });
}

module.exports = {
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_WINDOW_SIZE,
  ACADEMIC_PATTERNS,
  classifyAcademicDomain,
  detectPatterns,
  generateReport,
  groupFailures,
  inspect,
  loadRunsFromAuditLog,
  normalizeFailureReason,
  suggestAction,
};
