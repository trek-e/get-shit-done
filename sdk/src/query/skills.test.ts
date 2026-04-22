/**
 * Tests for agent skills query handlers.
 *
 * agentSkills — config-driven: reads config.agent_skills[agentType], returns <agent_skills> block.
 * listSkills  — filesystem scan: discovers all skill dirs, returns structured object.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { agentSkills, listSkills } from './skills.js';

function writeSkill(rootDir: string, name: string, description = 'Skill under test') {
  const skillDir = join(rootDir, name);
  return mkdir(skillDir, { recursive: true }).then(() => writeFile(join(skillDir, 'SKILL.md'), [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    `# ${name}`,
  ].join('\n')));
}

async function writeConfig(tmpDir: string, config: Record<string, unknown>) {
  const planningDir = join(tmpDir, '.planning');
  await mkdir(planningDir, { recursive: true });
  await writeFile(join(planningDir, 'config.json'), JSON.stringify(config));
}

// ─── listSkills (filesystem scan) ───────────────────────────────────────────

describe('listSkills', () => {
  let tmpDir: string;
  let homeDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-skills-'));
    homeDir = await mkdtemp(join(tmpdir(), 'gsd-skills-home-'));
    await writeSkill(join(tmpDir, '.cursor', 'skills'), 'my-skill');
    await writeSkill(join(tmpDir, '.codex', 'skills'), 'project-codex');
    await mkdir(join(tmpDir, '.claude', 'skills', 'orphaned-dir'), { recursive: true });
    await writeSkill(join(homeDir, '.claude', 'skills'), 'global-claude');
    await writeSkill(join(homeDir, '.codex', 'skills'), 'global-codex');
    await writeSkill(join(homeDir, '.claude', 'get-shit-done', 'skills'), 'legacy-import');
    vi.stubEnv('HOME', homeDir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  it('returns deduped skill names from project and managed global skill dirs', async () => {
    const r = await listSkills(['gsd-executor'], tmpDir);
    const data = r.data as Record<string, unknown>;
    const skills = data.skills as string[];

    expect(skills).toEqual(expect.arrayContaining([
      'my-skill',
      'project-codex',
      'global-claude',
      'global-codex',
    ]));
    expect(skills).not.toContain('orphaned-dir');
    expect(skills).not.toContain('legacy-import');
    expect(data.skill_count).toBe(skills.length);
  });

  it('counts deduped skill names when the same skill exists in multiple roots', async () => {
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'shared-skill');
    await writeSkill(join(tmpDir, '.agents', 'skills'), 'shared-skill');

    const r = await listSkills(['gsd-executor'], tmpDir);
    const data = r.data as Record<string, unknown>;
    const skills = data.skills as string[];

    expect(skills.filter((skill) => skill === 'shared-skill')).toHaveLength(1);
    expect(data.skill_count).toBe(skills.length);
  });
});

// ─── agentSkills (config-driven) ────────────────────────────────────────────

describe('agentSkills', () => {
  let tmpDir: string;
  let homeDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-agent-skills-'));
    homeDir = await mkdtemp(join(tmpdir(), 'gsd-agent-skills-home-'));
    vi.stubEnv('HOME', homeDir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  it('returns empty string when no agent type provided', async () => {
    await writeConfig(tmpDir, {});
    const r = await agentSkills([], tmpDir);
    expect(r.data).toBe('');
  });

  it('returns empty string when config has no agent_skills', async () => {
    await writeConfig(tmpDir, { model_profile: 'balanced' });
    const r = await agentSkills(['gsd-planner'], tmpDir);
    expect(r.data).toBe('');
  });

  it('returns empty string when agent type not in agent_skills config', async () => {
    await writeConfig(tmpDir, { agent_skills: { 'gsd-executor': ['.claude/skills/my-skill'] } });
    const r = await agentSkills(['gsd-planner'], tmpDir);
    expect(r.data).toBe('');
  });

  it('returns formatted <agent_skills> block for configured skill path', async () => {
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'my-skill');
    await writeConfig(tmpDir, {
      agent_skills: { 'gsd-planner': ['.claude/skills/my-skill'] },
    });

    const r = await agentSkills(['gsd-planner'], tmpDir);
    expect(r.data).toBe(
      '<agent_skills>\nRead these user-configured skills:\n- @.claude/skills/my-skill/SKILL.md\n</agent_skills>',
    );
  });

  it('supports multiple skill paths in a single agent_skills entry', async () => {
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'skill-a');
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'skill-b');
    await writeConfig(tmpDir, {
      agent_skills: {
        'gsd-executor': ['.claude/skills/skill-a', '.claude/skills/skill-b'],
      },
    });

    const r = await agentSkills(['gsd-executor'], tmpDir);
    const block = r.data as string;
    expect(block).toContain('- @.claude/skills/skill-a/SKILL.md');
    expect(block).toContain('- @.claude/skills/skill-b/SKILL.md');
    expect(block).toMatch(/^<agent_skills>/);
    expect(block).toMatch(/<\/agent_skills>$/);
  });

  it('accepts a single string (not array) in agent_skills config', async () => {
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'solo-skill');
    await writeConfig(tmpDir, {
      agent_skills: { 'gsd-executor': '.claude/skills/solo-skill' },
    });

    const r = await agentSkills(['gsd-executor'], tmpDir);
    expect(r.data).toContain('- @.claude/skills/solo-skill/SKILL.md');
  });

  it('skips missing skill paths silently', async () => {
    await writeConfig(tmpDir, {
      agent_skills: { 'gsd-executor': ['.claude/skills/nonexistent'] },
    });

    const r = await agentSkills(['gsd-executor'], tmpDir);
    expect(r.data).toBe('');
  });

  it('skips path traversal attempts', async () => {
    await writeConfig(tmpDir, {
      agent_skills: { 'gsd-executor': ['../../../etc/passwd'] },
    });

    const r = await agentSkills(['gsd-executor'], tmpDir);
    expect(r.data).toBe('');
  });

  it('supports global: prefix for ~/.claude/skills/ (#1992)', async () => {
    await writeSkill(join(homeDir, '.claude', 'skills'), 'global-skill');
    await writeConfig(tmpDir, {
      agent_skills: { 'gsd-planner': ['global:global-skill'] },
    });

    const r = await agentSkills(['gsd-planner'], tmpDir);
    const block = r.data as string;
    expect(block).toMatch(/- @.*global-skill\/SKILL\.md/);
    expect(block).toMatch(/^<agent_skills>/);
  });

  it('skips global: entries with invalid skill names', async () => {
    await writeConfig(tmpDir, {
      agent_skills: { 'gsd-executor': ['global:../../bad-name'] },
    });

    const r = await agentSkills(['gsd-executor'], tmpDir);
    expect(r.data).toBe('');
  });

  it('skips global: entries with missing SKILL.md', async () => {
    await writeConfig(tmpDir, {
      agent_skills: { 'gsd-executor': ['global:no-such-skill'] },
    });

    const r = await agentSkills(['gsd-executor'], tmpDir);
    expect(r.data).toBe('');
  });
});
