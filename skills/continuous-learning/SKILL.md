---
name: continuous-learning
description: Extract reusable patterns from paper writing sessions and save them as learned skills for future use.
origin: everypaper
---

# Continuous Learning Skill

Evaluates paper writing sessions at end to extract reusable patterns that can be saved as learned skills.

## When to Activate

- Setting up automatic pattern extraction from paper writing sessions
- Configuring the Stop hook for session evaluation
- Reviewing or curating learned skills in `~/.claude/skills/learned/`
- Adjusting extraction thresholds or pattern categories

## How It Works

This skill runs as a **Stop hook** at the end of each session:

1. **Session Evaluation**: Checks if session has enough messages (default: 8+)
2. **Pattern Detection**: Identifies extractable patterns from the session
3. **Skill Extraction**: Saves useful patterns to `~/.claude/skills/learned/`

## Configuration

Edit `config.json` to customize:

```json
{
  "min_session_length": 8,
  "extraction_threshold": "medium",
  "auto_approve": false,
  "learned_skills_path": "~/.claude/skills/learned/",
  "patterns_to_detect": [
    "citation_resolution",
    "data_processing",
    "bibtex_fixes",
    "statistical_methods",
    "writing_techniques",
    "latex_compilation",
    "reference_management"
  ],
  "ignore_patterns": [
    "simple_typos",
    "one_time_fixes",
    "external_api_issues",
    "network_timeouts"
  ]
}
```

## Pattern Types

| Pattern | Description |
|---------|-------------|
| `citation_resolution` | How citation issues were resolved |
| `data_processing` | Effective data cleaning/transform approaches |
| `bibtex_fixes` | BibTeX format and parsing fixes |
| `statistical_methods` | Correct statistical test selection and reporting |
| `writing_techniques` | Academic writing improvements |
| `latex_compilation` | LaTeX build and package fixes |
| `reference_management` | Reference organization patterns |

## Hook Setup

Already configured in `hooks/hooks.json` as `stop:evaluate-session` hook.

## Principles

- **Human is researcher**: AI extracts patterns, human reviews and approves
- **No fabrication**: Learned skills must reference real paper writing experiences
- **Local verification**: Patterns should be verifiable against session transcripts
- **Conservative extraction**: Only extract when confidence is high

## Related

- `scripts/lib/inspection.js` — Failure pattern detection
- `scripts/lib/skill-evolution/` — Skill versioning and provenance tracking
- `stop:evaluate-session` hook — Session quality evaluation
