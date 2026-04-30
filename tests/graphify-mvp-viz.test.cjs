/**
 * graphify — MVP visual differentiation contract test
 * Per PRD Q5: distinct node color + 'MVP' label suffix.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CMD = path.join(__dirname, '..', 'commands', 'gsd', 'graphify.md');

describe('graphify — MVP visualization', () => {
  const content = fs.readFileSync(CMD, 'utf-8');

  test('command documents distinct color for MVP-mode phases', () => {
    assert.match(content, /MVP/, 'must mention MVP in color rule');
    assert.match(
      content,
      /color|fill|hex|#[0-9a-f]{3,6}/i,
      'must reference a color/fill rule for MVP nodes'
    );
  });

  test('command documents MVP label suffix on node text', () => {
    assert.match(
      content,
      /MVP[^\n]*label|label[^\n]*MVP|MVP\s*suffix|suffix[^\n]*MVP/i,
      'must add an MVP label/suffix to node text'
    );
  });

  test('falls back to standard rendering when phase mode is null', () => {
    assert.match(
      content,
      /mode[^\n]*null|absent|not.*mvp|standard.*render/i,
      'must specify fallback when mode is not mvp'
    );
  });
});
