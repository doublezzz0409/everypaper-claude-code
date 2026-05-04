#!/usr/bin/env node
/**
 * PostToolUse:Bash Hook — Calculation Code Archival
 *
 * Detects Python/R code execution and saves the code to output/data/scripts/
 * for traceability and reproducibility.
 *
 * Supported patterns:
 *   python -c "code"
 *   python script.py
 *   python3 -c "code"
 *   Rscript -e "code"
 *   Rscript script.R
 *   R -e "code"
 *   jupyter nbconvert --execute notebook.ipynb
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getOutputDir, ensureDir, writeFile, writeJson, readFile, getTimestamp, log } = require('../lib/utils');
const pipeline = require('../lib/pipeline');

const SCRIPTS_DIR = () => path.join(getOutputDir(), 'data', 'scripts');
const INDEX_FILE = () => path.join(getOutputDir(), 'data', 'scripts', '_index.json');
const DATA_CHECKSUMS_FILE = () => path.join(getOutputDir(), 'data', '_data-checksums.json');

/**
 * Compute SHA256 checksum of a file
 */
function computeFileChecksum(filePath) {
  try {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) return null;
    const content = fs.readFileSync(absPath);
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  } catch {
    return null;
  }
}

/**
 * Load saved data checksums
 */
function loadDataChecksums() {
  try {
    return JSON.parse(fs.readFileSync(DATA_CHECKSUMS_FILE(), 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Save data checksums
 */
function saveDataChecksums(checksums) {
  writeJson(DATA_CHECKSUMS_FILE(), checksums);
}

const CODE_PATTERNS = [
  // python -c "code" or python3 -c "code"
  {
    lang: 'python',
    regex: /^python3?\s+-c\s+["'](.*)["']\s*$/s,
    extract: (m) => ({ code: m[1], type: 'inline' }),
  },
  // python script.py
  {
    lang: 'python',
    regex: /^python3?\s+([\w./\\-]+\.py)\s*(.*)?$/s,
    extract: (m) => ({ code: null, scriptPath: m[1], args: m[2] || '', type: 'file' }),
  },
  // Rscript -e "code" or R -e "code"
  {
    lang: 'r',
    regex: /^(?:Rscript|R)\s+-e\s+["'](.*)["']\s*$/s,
    extract: (m) => ({ code: m[1], type: 'inline' }),
  },
  // Rscript script.R
  {
    lang: 'r',
    regex: /^Rscript\s+([\w./\\-]+\.R)\s*(.*)?$/s,
    extract: (m) => ({ code: null, scriptPath: m[1], args: m[2] || '', type: 'file' }),
  },
  // jupyter nbconvert --execute
  {
    lang: 'python',
    regex: /^jupyter\s+nbconvert\s+--execute\s+([\w./\\-]+\.ipynb)/,
    extract: (m) => ({ code: null, scriptPath: m[1], type: 'notebook' }),
  },
];

/**
 * Extract data file references from code or command
 */
function extractDataRefs(code, command) {
  const combined = `${code || ''} ${command || ''}`;
  const refs = [];
  const patterns = [
    /["']([^"']*\.(?:csv|xlsx?|dta|sav|parquet|feather|json))["']/gi,
    /(?:^|\s)([\w./\\-]+\.(?:csv|xlsx?|dta|sav|parquet|feather|json))(?:\s|$)/gm,
    /(?:read_csv|read_excel|read_dta|read_sav|read_parquet|fread|load)\s*\(\s*["']([^"']+)["']/gi,
    /(?:open|pd\.read_|scan|read\.table|read\.csv)\s*\(\s*["']([^"']+)["']/gi,
  ];
  for (const pat of patterns) {
    let match;
    while ((match = pat.exec(combined)) !== null) {
      if (!refs.includes(match[1])) refs.push(match[1]);
    }
  }
  return refs;
}

/**
 * Read next sequential script number from index
 */
function getNextScriptNumber() {
  const indexFile = INDEX_FILE();
  try {
    const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    return (index.lastNumber || 0) + 1;
  } catch {
    return 1;
  }
}

/**
 * Update the scripts index
 */
function updateIndex(entry) {
  const indexFile = INDEX_FILE();
  let index;
  try {
    index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  } catch {
    index = { lastNumber: 0, scripts: [] };
  }
  index.lastNumber = entry.number;
  index.scripts.push({
    number: entry.number,
    file: entry.savedFile,
    lang: entry.lang,
    timestamp: entry.timestamp,
    command: entry.command,
    exitCode: entry.exitCode,
    dataRefs: entry.dataRefs,
    checksum: entry.checksum,
  });
  writeJson(indexFile, index);
}

function run(rawInput) {
  try {
    const data = JSON.parse(rawInput);
    const command = data.command || data.tool_input?.command || '';
    const exitCode = data.exit_code || data.result?.exit_code || 0;
    const output = data.output || data.result?.stdout || '';

    // Try each pattern
    let matched = null;
    for (const pat of CODE_PATTERNS) {
      const m = command.match(pat.regex);
      if (m) {
        matched = { ...pat.extract(m), lang: pat.lang };
        break;
      }
    }

    if (!matched) return rawInput;

    // Resolve code content
    let codeContent = matched.code;
    if (matched.type === 'file' && matched.scriptPath) {
      try {
        const resolvedPath = path.resolve(matched.scriptPath);
        if (fs.existsSync(resolvedPath)) {
          codeContent = fs.readFileSync(resolvedPath, 'utf8');
        }
      } catch {
        // If file can't be read, record the command only
      }
    }

    if (!codeContent && matched.type !== 'notebook') return rawInput;

    // Prepare save
    const scriptsDir = ensureDir(SCRIPTS_DIR());
    const num = getNextScriptNumber();
    const ext = matched.lang === 'r' ? '.R' : '.py';
    const filename = `calc_${String(num).padStart(3, '0')}${ext}`;
    const savedPath = path.join(scriptsDir, filename);
    const timestamp = getTimestamp();

    // Build save content with metadata header
    const dataRefs = extractDataRefs(codeContent, command);
    const header = [
      `# Calculation Script #${num}`,
      `# Timestamp: ${timestamp}`,
      `# Language: ${matched.lang}`,
      `# Command: ${command}`,
      `# Exit Code: ${exitCode}`,
      dataRefs.length > 0 ? `# Data Files: ${dataRefs.join(', ')}` : null,
      `# ---`,
      '',
    ].filter(Boolean).join('\n');

    const fullContent = header + (codeContent || '') + '\n';
    const checksum = crypto.createHash('sha256').update(fullContent).digest('hex').substring(0, 16);

    writeFile(savedPath, fullContent);

    // Save result metadata
    const metaFile = path.join(scriptsDir, `calc_${String(num).padStart(3, '0')}_meta.json`);
    writeJson(metaFile, {
      number: num,
      timestamp,
      lang: matched.lang,
      type: matched.type,
      command,
      exitCode,
      dataRefs,
      savedFile: filename,
      checksum,
      outputPreview: output.substring(0, 500),
    });

    // Compute and save data file checksums
    const dataChecksums = loadDataChecksums();
    const dataSnapshot = {};
    for (const ref of dataRefs) {
      const cs = computeFileChecksum(ref);
      if (cs) {
        dataSnapshot[ref] = cs;
        dataChecksums[ref] = { checksum: cs, lastSeen: timestamp, script: filename };
      }
    }
    saveDataChecksums(dataChecksums);

    // Update meta with data checksums
    const metaWithChecksums = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    metaWithChecksums.dataChecksums = dataSnapshot;
    writeJson(metaFile, metaWithChecksums);

    // Update index
    updateIndex({
      number: num,
      savedFile: filename,
      lang: matched.lang,
      timestamp,
      command,
      exitCode,
      dataRefs,
      checksum,
    });

    // Pipeline integration: auto-register step in plan.json if it exists
    try {
      const plan = pipeline.loadPlan();
      if (plan) {
        // Find the next pending step or the last step
        const pendingStep = plan.steps.find(s => s.status === 'pending');
        const targetStep = pendingStep || plan.steps[plan.steps.length - 1];
        if (targetStep) {
          pipeline.updateStepCode(plan, targetStep.id, filename);
          // Save snapshot if output file exists
          if (targetStep.output) {
            const outputDir = getOutputDir();
            const outputPath = path.join(outputDir, 'data', targetStep.output);
            const snap = pipeline.computeResultSnapshot(outputPath);
            if (snap) {
              pipeline.saveSnapshot(plan, targetStep.id, snap);
            }
          }
        }
      }
    } catch {
      // Pipeline integration is best-effort, never block execution
    }

    // Rule learning: profile data files and learn patterns
    try {
      const ruleLearner = require('../lib/rule-learner');
      for (const ref of dataRefs) {
        const absPath = path.resolve(ref);
        if (fs.existsSync(absPath)) {
          const result = ruleLearner.learnFromExecution(absPath);
          if (result.evolvedRules.length > 0) {
            const msg = ruleLearner.formatLearnedRules(result.evolvedRules);
            process.stderr.write(msg + '\n');
          }
        }
      }
    } catch {
      // Rule learning is best-effort, never block execution
    }

    // Environment tracking: detect Python package version changes
    if (matched.lang === 'python') {
      try {
        const envTracker = require('../lib/env-tracker');
        const envResult = envTracker.trackEnvironment('python');
        if (envResult.hasCriticalChange) {
          const msg = envTracker.formatEnvChanges(envResult);
          if (msg) process.stderr.write(msg + '\n');
        }
      } catch {
        // Env tracking is best-effort, never block execution
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

module.exports = { run, CODE_PATTERNS, extractDataRefs, computeFileChecksum, loadDataChecksums, saveDataChecksums, DATA_CHECKSUMS_FILE };
