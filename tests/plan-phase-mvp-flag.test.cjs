/**
 * plan-phase workflow — --mvp flag parsing and MVP_MODE resolution
 * Contract test: verifies the workflow markdown documents the agreed
 * resolution order (CLI flag → roadmap mode → config → default false).
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md');

describe('plan-phase workflow — --mvp flag', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf-8');

  test('argument list documents --mvp flag', () => {
    const argsLine = content.match(/Extract from \$ARGUMENTS:[^\n]*/);
    assert.ok(argsLine, 'Step 2 arg-extraction line not found');
    assert.match(argsLine[0], /--mvp/, 'argument list must mention --mvp');
  });

  test('workflow defines MVP_MODE resolution block', () => {
    assert.match(content, /MVP_MODE/, 'workflow must declare MVP_MODE');
    assert.match(content, /workflow\.mvp_mode/, 'must read workflow.mvp_mode config');
    assert.match(
      content,
      /roadmap[^\n]*mode|phase[^\n]*\.mode/i,
      'must consult phase mode from roadmap'
    );
  });

  test('Walking Skeleton gate references new-project + Phase 1', () => {
    assert.match(content, /SKELETON\.md/, 'workflow must mention SKELETON.md');
    assert.match(
      content,
      /Walking Skeleton|walking_skeleton/i,
      'workflow must label the gate as Walking Skeleton'
    );
  });

  test('planner spawn passes MVP_MODE to gsd-planner', () => {
    assert.match(
      content,
      /MVP_MODE[^\n]*planner|planner[^\n]*MVP_MODE/i,
      'workflow must wire MVP_MODE into the planner subagent prompt'
    );
  });
});
