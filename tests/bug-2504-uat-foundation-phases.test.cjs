/**
 * Regression test for bug #2504
 *
 * When UAT testing is mandated and a phase has no user-facing elements
 * (e.g., code foundations, database schema, internal APIs), the agent
 * invented artificial UAT steps — things like "manually run git commits",
 * "manually invoke methods", "manually check database state" — and left
 * work half-finished specifically to create things for a human to do.
 *
 * Fix: The verify-phase workflow's identify_human_verification step must
 * explicitly handle phases with no user-facing elements by auto-passing UAT
 * with a logged rationale instead of inventing manual steps.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const VERIFY_PHASE_PATH = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'verify-phase.md'
);

describe('bug #2504: UAT auto-pass for foundation/infrastructure phases', () => {
  const content = fs.readFileSync(VERIFY_PHASE_PATH, 'utf-8');

  test('verify-phase workflow file exists', () => {
    assert.ok(
      fs.existsSync(VERIFY_PHASE_PATH),
      'get-shit-done/workflows/verify-phase.md should exist'
    );
  });

  test('identify_human_verification step handles phases with no user-facing elements', () => {
    // The step must explicitly call out the infrastructure/foundation case
    const hasInfrastructureHandling =
      content.includes('infrastructure') ||
      content.includes('foundation') ||
      content.includes('no user-facing') ||
      content.includes('no user facing') ||
      content.includes('internal API') ||
      content.includes('internal APIs') ||
      content.includes('database schema') ||
      content.includes('code foundation');

    assert.ok(
      hasInfrastructureHandling,
      'verify-phase.md must explicitly handle infrastructure/foundation phases ' +
      'that have no user-facing elements. Without this, agents invent artificial ' +
      'manual steps to satisfy UAT requirements (root cause of #2504).'
    );
  });

  test('workflow includes auto-pass or skip UAT language for non-user-facing phases', () => {
    const hasAutoPass =
      content.includes('auto-pass') ||
      content.includes('auto pass') ||
      content.includes('automatically pass') ||
      content.includes('skip UAT') ||
      content.includes('skip the UAT') ||
      content.includes('UAT does not apply') ||
      content.includes('UAT not applicable') ||
      content.includes('no UAT required');

    assert.ok(
      hasAutoPass,
      'verify-phase.md must contain language about auto-passing or skipping UAT ' +
      'for phases without user-facing elements. Agents must not invent manual steps ' +
      'when there is nothing user-facing to test (root cause of #2504).'
    );
  });

  test('workflow prohibits inventing artificial manual steps for infrastructure phases', () => {
    // The workflow must tell the agent NOT to invent steps when there's nothing to test.
    // Look for explicit prohibition or the inverse: "do not invent" or "must not create"
    // or equivalent framing like "only require human testing when..."
    const hasProhibition =
      content.includes('do not invent') ||
      content.includes('must not invent') ||
      content.includes('never invent') ||
      content.includes('Do not invent') ||
      content.includes('Must not invent') ||
      content.includes('Never invent') ||
      content.includes('only require human') ||
      content.includes('only add human') ||
      content.includes('only flag') && content.includes('user-facing') ||
      // Or via "N/A" framing
      content.includes('N/A') && (
        content.includes('infrastructure') ||
        content.includes('foundation') ||
        content.includes('no user-facing')
      );

    assert.ok(
      hasProhibition,
      'verify-phase.md must explicitly prohibit inventing artificial manual UAT steps ' +
      'for infrastructure phases. The current wording causes agents to create fake ' +
      '"manually run git commits" steps to satisfy UAT mandates (root cause of #2504).'
    );
  });

  test('workflow includes a concept of N/A or not-applicable UAT state', () => {
    const hasNaState =
      content.includes('N/A') ||
      content.includes('not applicable') ||
      content.includes('not_applicable') ||
      content.includes('no_uat') ||
      content.includes('uat_not_applicable') ||
      content.includes('infrastructure phase') ||
      content.includes('foundation phase');

    assert.ok(
      hasNaState,
      'verify-phase.md must include some concept of a "not applicable" or N/A ' +
      'UAT state for phases with no user-facing elements. This prevents agents ' +
      'from blocking phase completion on invented manual steps (root cause of #2504).'
    );
  });
});
