'use strict';

/**
 * Bug #2555: SDK `agent-skills` query handler ignores `config.agent_skills[agentType]`.
 *
 * The fix changes `agentSkills` to read config.agent_skills[agentType] and return
 * a formatted <agent_skills> block (matching the legacy gsd-tools.cjs path).
 * The old scan-all behavior moves to `listSkills` registered as `list-skills`.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS_SRC = path.join(
  __dirname, '..', 'sdk', 'src', 'query', 'skills.ts',
);

const INDEX_SRC = path.join(
  __dirname, '..', 'sdk', 'src', 'query', 'index.ts',
);

describe('SDK agent-skills config-driven fix (#2555)', () => {
  test('skills.ts source exists', () => {
    assert.ok(fs.existsSync(SKILLS_SRC), 'sdk/src/query/skills.ts must exist');
  });

  test('agentSkills reads loadConfig (not just filesystem scan)', () => {
    const src = fs.readFileSync(SKILLS_SRC, 'utf-8');
    assert.ok(
      src.includes('loadConfig'),
      'agentSkills must call loadConfig to read config.agent_skills',
    );
  });

  test('agentSkills references agent_skills config key', () => {
    const src = fs.readFileSync(SKILLS_SRC, 'utf-8');
    assert.ok(
      src.includes('agent_skills'),
      'agentSkills must read agent_skills from config',
    );
  });

  test('agentSkills returns <agent_skills> block format (not JSON object)', () => {
    const src = fs.readFileSync(SKILLS_SRC, 'utf-8');
    assert.ok(
      src.includes('<agent_skills>'),
      'agentSkills must return the <agent_skills> block string for prompt injection',
    );
  });

  test('listSkills export exists for backwards-compat filesystem scan', () => {
    const src = fs.readFileSync(SKILLS_SRC, 'utf-8');
    assert.ok(
      src.includes('export const listSkills'),
      'listSkills must be exported for callers that need the scan-all behavior',
    );
  });

  test('list-skills is registered in query index', () => {
    const src = fs.readFileSync(INDEX_SRC, 'utf-8');
    assert.ok(
      src.includes("'list-skills'"),
      "index.ts must register 'list-skills' handler",
    );
  });

  test('agentSkills handles global: prefix (#1992)', () => {
    const src = fs.readFileSync(SKILLS_SRC, 'utf-8');
    assert.ok(
      src.includes("startsWith('global:')"),
      'agentSkills must support global: prefix for ~/.claude/skills/',
    );
  });
});
