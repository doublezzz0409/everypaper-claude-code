#!/usr/bin/env node
'use strict';

module.exports = function(ctx) {
  const hf = require('../../scripts/lib/hook-flags');

  // PROFILES structure
  ctx.assert(typeof hf.PROFILES === 'object', 'PROFILES exported as object');
  ctx.assert(Array.isArray(hf.PROFILES.minimal), 'minimal profile exists');
  ctx.assert(Array.isArray(hf.PROFILES.standard), 'standard profile exists');
  ctx.assert(Array.isArray(hf.PROFILES.strict), 'strict profile exists');
  ctx.assert(hf.PROFILES.minimal.length < hf.PROFILES.standard.length, 'minimal < standard hooks');
  ctx.assert(hf.PROFILES.standard.length < hf.PROFILES.strict.length, 'standard < strict hooks');

  // getActiveProfile
  const origProfile = process.env.EVERYPAPER_HOOK_PROFILE;
  delete process.env.EVERYPAPER_HOOK_PROFILE;
  ctx.assertEqual(hf.getActiveProfile(), 'standard', 'default profile is standard');

  process.env.EVERYPAPER_HOOK_PROFILE = 'minimal';
  ctx.assertEqual(hf.getActiveProfile(), 'minimal', 'env minimal works');
  process.env.EVERYPAPER_HOOK_PROFILE = 'strict';
  ctx.assertEqual(hf.getActiveProfile(), 'strict', 'env strict works');
  process.env.EVERYPAPER_HOOK_PROFILE = 'INVALID';
  ctx.assertEqual(hf.getActiveProfile(), 'standard', 'invalid falls back to standard');

  if (origProfile !== undefined) {
    process.env.EVERYPAPER_HOOK_PROFILE = origProfile;
  } else {
    delete process.env.EVERYPAPER_HOOK_PROFILE;
  }

  // isHookEnabled - core hooks
  ctx.assert(hf.isHookEnabled('pre:write:no-fabrication') === true, 'no-fabrication enabled in standard');
  ctx.assert(hf.isHookEnabled('pre:write:citation-check') === true, 'citation-check enabled in standard');
  ctx.assert(hf.isHookEnabled('stop:session-summary') === true, 'session-summary enabled in standard');

  // isHookEnabled - strict-only hooks
  const origP = process.env.EVERYPAPER_HOOK_PROFILE;
  process.env.EVERYPAPER_HOOK_PROFILE = 'minimal';
  ctx.assert(hf.isHookEnabled('pre:observe') === false, 'observe disabled in minimal');
  process.env.EVERYPAPER_HOOK_PROFILE = origP || '';

  // isHookEnabled - disabled hooks
  const origDisabled = process.env.EVERYPAPER_DISABLED_HOOKS;
  process.env.EVERYPAPER_DISABLED_HOOKS = 'pre:write:citation-check,stop:session-summary';
  ctx.assert(hf.isHookEnabled('pre:write:citation-check') === false, 'disabled hook returns false');
  ctx.assert(hf.isHookEnabled('pre:write:no-fabrication') === true, 'non-disabled hook stays true');
  if (origDisabled !== undefined) {
    process.env.EVERYPAPER_DISABLED_HOOKS = origDisabled;
  } else {
    delete process.env.EVERYPAPER_DISABLED_HOOKS;
  }

  // isHookEnabled - profiles option
  ctx.assert(hf.isHookEnabled('pre:write:no-fabrication', { profiles: 'standard,strict' }) === true, 'profile option match');
  const origP2 = process.env.EVERYPAPER_HOOK_PROFILE;
  process.env.EVERYPAPER_HOOK_PROFILE = 'minimal';
  ctx.assert(hf.isHookEnabled('pre:write:no-fabrication', { profiles: 'standard,strict' }) === false, 'profile option mismatch');
  process.env.EVERYPAPER_HOOK_PROFILE = origP2 || '';

  // unknown hook
  ctx.assert(hf.isHookEnabled('nonexistent:hook') === false, 'unknown hook returns false');
};
