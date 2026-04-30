/**
 * gsd-verifier agent — MVP Mode Verification section contract
 * Verifies the agent definition contains a section instructing the verifier
 * to emphasize user-visible outcomes under MVP mode.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const AGENT = path.join(__dirname, '..', 'agents', 'gsd-verifier.md');
const REF = path.join(__dirname, '..', 'get-shit-done', 'references', 'verify-mvp-mode.md');

describe('gsd-verifier — MVP Mode Verification section', () => {
  const content = fs.readFileSync(AGENT, 'utf-8');

  test('agent defines an MVP Mode Verification section', () => {
    assert.match(content, /MVP\s*Mode\s*Verification|MVP[\s-]?mode[\s-]?verif/i);
  });

  test('agent references verify-mvp-mode.md', () => {
    assert.match(content, /verify-mvp-mode\.md/);
  });

  test('agent preserves goal-backward terminology', () => {
    assert.match(content, /goal[\s-]?backward/i);
  });

  test('referenced file exists on disk', () => {
    assert.ok(fs.existsSync(REF));
  });
});
