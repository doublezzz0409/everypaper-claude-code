#!/usr/bin/env node
/**
 * Hook Profile Gating System
 *
 * Controls which hooks are enabled based on profile levels:
 * - minimal: Core anti-fabrication only (4 hooks)
 * - standard: All verification hooks (default, 10 hooks)
 * - strict: All hooks including observation and audit (13 hooks)
 *
 * Profile is set via EVERYPAPER_HOOK_PROFILE env var.
 * Individual hooks can be disabled via EVERYPAPER_DISABLED_HOOKS env var.
 */

'use strict';

const PROFILES = {
  minimal: [
    'pre:write:no-fabrication',
    'pre:write:citation-check',
    'pre:write:method-placeholder',
    'stop:session-summary',
    'stop:cost-tracker'
  ],
  standard: [
    'pre:bash:code-execution',
    'pre:write:no-fabrication',
    'pre:write:citation-check',
    'pre:write:method-placeholder',
    'post:bash:audit',
    'post:write:quality-check',
    'stop:session-summary',
    'session:start',
    'pre:compact',
    'post:tool-failure',
    'pre:config-protection',
    'stop:cost-tracker',
    'stop:evaluate-session',
    'stop:desktop-notify',
    'pre:write:structure-check',
    'pre:write:citation-format',
    'post:write:xref-check',
    'post:write:numbering-check',
    'post:figure:verify'
  ],
  strict: [
    'pre:bash:code-execution',
    'pre:write:no-fabrication',
    'pre:write:citation-check',
    'pre:write:method-placeholder',
    'post:bash:audit',
    'post:write:quality-check',
    'stop:session-summary',
    'session:start',
    'pre:compact',
    'post:tool-failure',
    'pre:observe',
    'post:observe',
    'pre:data:detect',
    'pre:config-protection',
    'stop:cost-tracker',
    'stop:evaluate-session',
    'stop:desktop-notify',
    'pre:write:structure-check',
    'pre:write:citation-format',
    'post:write:xref-check',
    'post:write:numbering-check',
    'post:figure:verify'
  ]
};

const DEFAULT_PROFILE = 'standard';

function getActiveProfile() {
  const env = (process.env.EVERYPAPER_HOOK_PROFILE || '').toLowerCase().trim();
  if (env && PROFILES[env]) return env;
  return DEFAULT_PROFILE;
}

function getDisabledHooks() {
  const raw = process.env.EVERYPAPER_DISABLED_HOOKS || '';
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function isHookEnabled(hookId, options = {}) {
  const profiles = options.profiles || '';

  if (profiles) {
    const allowed = profiles.split(',').map(s => s.trim().toLowerCase());
    const active = getActiveProfile();
    if (!allowed.includes(active)) return false;
  }

  const disabled = getDisabledHooks();
  if (disabled.includes(hookId.toLowerCase())) return false;

  const activeProfile = getActiveProfile();
  const enabledHooks = PROFILES[activeProfile] || PROFILES[DEFAULT_PROFILE];
  return enabledHooks.includes(hookId);
}

module.exports = { isHookEnabled, getActiveProfile, PROFILES };
