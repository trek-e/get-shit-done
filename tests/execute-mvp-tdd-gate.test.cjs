/**
 * execute-phase MVP+TDD gate — contract test
 * Verifies the workflow markdown documents the gate's resolution chain,
 * per-task firing condition, and end-of-phase review escalation.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');

describe('execute-phase — MVP+TDD gate', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf-8');

  test('Step 1 resolves MVP_MODE from roadmap mode field', () => {
    assert.match(content, /MVP_MODE/, 'workflow must declare MVP_MODE');
    assert.match(
      content,
      /roadmap[^\n]*mode|phase[^\n]*\.mode|\.mode\s*=/i,
      'must consult phase mode from roadmap'
    );
  });

  test('gate fires when both MVP_MODE and TDD_MODE are true', () => {
    assert.match(
      content,
      /MVP_MODE[^\n]*TDD_MODE|TDD_MODE[^\n]*MVP_MODE/,
      'workflow must combine MVP_MODE and TDD_MODE for the gate'
    );
  });

  test('per-task gate is documented before behavior-adding task execution', () => {
    assert.match(content, /MVP\+TDD\s*gate|mvp[\s-]?tdd[\s-]?gate/i, 'must label the gate');
    assert.match(content, /failing[\s-]?test\s*commit|test\(.+\):.*RED/i, 'must reference failing-test commit check');
  });

  test('end-of-phase TDD review escalates to blocking under MVP+TDD', () => {
    assert.match(
      content,
      /blocking[^\n]*MVP|MVP[^\n]*blocking|escalat\w+\s*to\s*blocking/i,
      'must escalate end-of-phase review to blocking'
    );
  });

  test('workflow references execute-mvp-tdd.md', () => {
    assert.match(content, /execute-mvp-tdd\.md/, 'must reference the gate semantics file');
  });
});
