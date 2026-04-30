/**
 * new-project workflow — MVP mode prompt contract test
 * Verifies the workflow markdown documents the Vertical MVP / Horizontal Layers
 * prompt and the ROADMAP.md template branch under MVP mode.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'new-project.md');

describe('new-project — MVP mode prompt', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf-8');

  test('workflow includes Vertical MVP option in mode prompt', () => {
    assert.match(content, /Vertical\s*MVP/i, 'must mention Vertical MVP option');
  });

  test('workflow includes Horizontal Layers option in mode prompt', () => {
    assert.match(content, /Horizontal\s*Layers/i, 'must mention Horizontal Layers option');
  });

  test('ROADMAP template emits **Mode:** mvp under Vertical MVP path', () => {
    assert.match(
      content,
      /\*\*Mode:\*\*\s*mvp/,
      'must emit **Mode:** mvp on initial roadmap phases under Vertical MVP'
    );
  });

  test('workflow falls back to standard template when Horizontal Layers picked', () => {
    assert.match(
      content,
      /Horizontal[^\n]*standard|standard[^\n]*Horizontal|no.*Mode.*line/i,
      'must specify fallback to standard template'
    );
  });
});
