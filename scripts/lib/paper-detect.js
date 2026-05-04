#!/usr/bin/env node
/**
 * Paper Project Detection
 *
 * Detects paper type, research field, citation style, and data tools
 * by inspecting files in the project directory.
 *
 * ECC equivalent: scripts/lib/project-detect.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PAPER_TYPE_RULES = [
  {
    type: 'empirical',
    markers: ['data/', 'output/data/', 'analysis/'],
    contentPatterns: [/回归|regression/i, /假设|hypothese/i, /样本|sample/i, /实证|empirical/i],
    templateMarkers: ['empirical-study.md']
  },
  {
    type: 'review',
    markers: ['literature', 'review', 'survey'],
    contentPatterns: [/综述|review|survey/i, /文献|literature/i, /研究进展|progress/i],
    templateMarkers: ['literature-review.md']
  },
  {
    type: 'theoretical',
    markers: ['theory', 'framework', 'model'],
    contentPatterns: [/理论|theory/i, /框架|framework/i, /模型构建|model\s+build/i],
    templateMarkers: []
  },
  {
    type: 'case-study',
    markers: ['case', 'study', 'interview'],
    contentPatterns: [/案例|case\s+study/i, /访谈|interview/i, /扎根|grounded/i],
    templateMarkers: []
  }
];

const FIELD_RULES = [
  { field: 'finance', patterns: [/金融|finance|stock|股票|基金|fund|银行|bank|资产定价|asset.pricing/i] },
  { field: 'economics', patterns: [/经济|economi|宏观|macro|微观|micro|GDP|通胀|inflation/i] },
  { field: 'management', patterns: [/管理|management|战略|strategy|组织|organiz/i] },
  { field: 'accounting', patterns: [/会计|accounting|审计|audit|财务|financi/i] },
  { field: 'marketing', patterns: [/营销|marketing|消费者|consumer|品牌|brand/i] },
  { field: 'statistics', patterns: [/统计|statistic|计量|econometr|贝叶斯|bayes/i] },
  { field: 'computer-science', patterns: [/机器学习|machine.learning|深度学习|deep.learning|算法|algorithm/i] },
  { field: 'psychology', patterns: [/心理|psycholog|认知|cognit|行为|behavio/i] },
  { field: 'sociology', patterns: [/社会|social|阶层|class|不平等|inequality/i] },
  { field: 'education', patterns: [/教育|education|教学|teaching|学生|student/i] }
];

const CITATION_STYLE_RULES = [
  { style: 'apa', patterns: [/\([A-Z][a-z]+,\s*\d{4}\)/, /\([A-Z][a-z]+\s+&\s+[A-Z][a-z]+,\s*\d{4}\)/] },
  { style: 'mla', patterns: [/\([A-Z][a-z]+\s+\d+\)/, /\([A-Z][a-z]+\s+et\s+al\.\s+\d+\)/] },
  { style: 'chicago', patterns: [/\([A-Z][a-z]+\s+\d{4},\s*\d+\)/, /\d+\.\s+[A-Z][a-z]+/] },
  { style: 'gb', patterns: [/\[\d+\]/, /参考文献|references/i] }
];

const DATA_TOOL_RULES = [
  { tool: 'python', patterns: [/\.py$/, /python|pip|conda|jupyter/i], fileMarkers: ['requirements.txt', 'pyproject.toml', '.ipynb'] },
  { tool: 'r', patterns: [/\.R$/, /Rscript|library\(|require\(/i], fileMarkers: ['DESCRIPTION', '.Rproj', 'renv.lock'] },
  { tool: 'stata', patterns: [/\.do$|\.dta$/, /stata/i], fileMarkers: [] },
  { tool: 'spss', patterns: [/\.sav$|\.sps$/, /spss/i], fileMarkers: [] },
  { tool: 'sas', patterns: [/\.sas$|\.sas7bdat$/, /sas/i], fileMarkers: [] },
  { tool: 'excel', patterns: [/\.xlsx?$|\.csv$/i], fileMarkers: [] }
];

function scanFiles(dir, maxDepth = 2) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  function walk(currentDir, depth) {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(dir, fullPath);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          results.push(relPath);
        }
      }
    } catch { /* Permission denied */ }
  }
  walk(dir, 0);
  return results;
}

function readPartial(filePath, maxBytes = 5000) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(fd, buf, 0, maxBytes, 0);
    fs.closeSync(fd);
    return buf.toString('utf8', 0, bytesRead);
  } catch {
    return '';
  }
}

function detectPaperType(projectDir) {
  const files = scanFiles(projectDir);
  const scores = PAPER_TYPE_RULES.map(rule => {
    let score = 0;
    const evidence = [];
    for (const marker of rule.markers) {
      if (files.some(f => f.toLowerCase().includes(marker.toLowerCase()))) {
        score += 2;
        evidence.push(`File match: ${marker}`);
      }
    }
    const templatesDir = path.join(projectDir, 'templates');
    for (const template of rule.templateMarkers) {
      if (fs.existsSync(path.join(templatesDir, template))) {
        score += 3;
        evidence.push(`Template: ${template}`);
      }
    }
    const sectionsDir = path.join(projectDir, 'output', 'sections');
    if (fs.existsSync(sectionsDir)) {
      const sectionFiles = fs.readdirSync(sectionsDir).filter(f => f.endsWith('.md'));
      for (const sf of sectionFiles.slice(0, 5)) {
        const content = readPartial(path.join(sectionsDir, sf));
        for (const pattern of rule.contentPatterns) {
          if (pattern.test(content)) { score += 1; evidence.push(`Content match in ${sf}`); break; }
        }
      }
    }
    const claudeMd = readPartial(path.join(projectDir, 'CLAUDE.md'));
    for (const pattern of rule.contentPatterns) {
      if (pattern.test(claudeMd)) { score += 2; evidence.push('CLAUDE.md match'); break; }
    }
    return { type: rule.type, score, evidence };
  });
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  return { type: best.score > 0 ? best.type : 'unknown', confidence: Math.min(best.score / 10, 1), evidence: best.evidence };
}

function detectResearchField(projectDir) {
  const files = scanFiles(projectDir);
  const allContent = [];
  allContent.push(readPartial(path.join(projectDir, 'CLAUDE.md')));
  const sectionsDir = path.join(projectDir, 'output', 'sections');
  if (fs.existsSync(sectionsDir)) {
    fs.readdirSync(sectionsDir).filter(f => f.endsWith('.md')).slice(0, 5).forEach(sf => {
      allContent.push(readPartial(path.join(sectionsDir, sf)));
    });
  }
  const templatesDir = path.join(projectDir, 'templates');
  if (fs.existsSync(templatesDir)) {
    fs.readdirSync(templatesDir).filter(f => f.endsWith('.md')).forEach(tf => {
      allContent.push(readPartial(path.join(templatesDir, tf)));
    });
  }
  const combinedContent = allContent.join('\n');
  const fileNames = files.join(' ');
  const scores = FIELD_RULES.map(rule => {
    let score = 0;
    const evidence = [];
    for (const pattern of rule.patterns) {
      const cm = (combinedContent.match(pattern) || []).length;
      const fm = (fileNames.match(pattern) || []).length;
      score += cm + fm * 2;
      if (cm > 0) evidence.push(`Content: ${pattern.source}`);
      if (fm > 0) evidence.push(`Filename: ${pattern.source}`);
    }
    return { field: rule.field, score, evidence };
  });
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  return { field: best.score > 0 ? best.field : 'unknown', confidence: Math.min(best.score / 10, 1), evidence: best.evidence };
}

function detectCitationStyle(projectDir) {
  const sectionsDir = path.join(projectDir, 'output', 'sections');
  if (!fs.existsSync(sectionsDir)) return { style: 'unknown', confidence: 0 };
  let combinedContent = '';
  fs.readdirSync(sectionsDir).filter(f => f.endsWith('.md')).slice(0, 5).forEach(sf => {
    combinedContent += readPartial(path.join(sectionsDir, sf)) + '\n';
  });
  const scores = CITATION_STYLE_RULES.map(rule => {
    let score = 0;
    for (const pattern of rule.patterns) score += (combinedContent.match(pattern) || []).length;
    return { style: rule.style, score };
  });
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  return { style: best.score > 0 ? best.style : 'unknown', confidence: Math.min(best.score / 5, 1) };
}

function detectDataTools(projectDir) {
  const files = scanFiles(projectDir);
  const detected = [];
  for (const rule of DATA_TOOL_RULES) {
    let found = false;
    for (const file of files) {
      for (const pattern of rule.patterns) {
        if (pattern.test(file)) { found = true; break; }
      }
      if (found) break;
    }
    if (!found) {
      for (const marker of rule.fileMarkers) {
        if (fs.existsSync(path.join(projectDir, marker))) { found = true; break; }
      }
    }
    if (found) detected.push(rule.tool);
  }
  return detected;
}

function detectProject(projectDir) {
  return {
    paperType: detectPaperType(projectDir),
    researchField: detectResearchField(projectDir),
    citationStyle: detectCitationStyle(projectDir),
    dataTools: detectDataTools(projectDir)
  };
}

module.exports = {
  detectProject, detectPaperType, detectResearchField, detectCitationStyle, detectDataTools,
  scanFiles, PAPER_TYPE_RULES, FIELD_RULES, CITATION_STYLE_RULES, DATA_TOOL_RULES
};
