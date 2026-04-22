/**
 * Agent skills query handlers.
 *
 * `agentSkills` — config-driven injection. Reads `config.agent_skills[agentType]`,
 * validates each configured path, and returns the formatted `<agent_skills>` block
 * ready for direct interpolation into Task() prompts. Matches legacy
 * `gsd-tools.cjs agent-skills <type>` behavior per docs/CONFIGURATION.md.
 *
 * `listSkills` — filesystem scan. Discovers every skill directory across project
 * and global roots regardless of config, returning a structured object.
 *
 * @example
 * ```typescript
 * import { agentSkills } from './skills.js';
 *
 * // With config: { agent_skills: { 'gsd-executor': ['.claude/skills/my-skill'] } }
 * await agentSkills(['gsd-executor'], '/project');
 * // { data: '<agent_skills>\nRead these user-configured skills:\n- @.claude/skills/my-skill/SKILL.md\n</agent_skills>' }
 *
 * // When no skills configured for agent type
 * await agentSkills(['gsd-executor'], '/project');
 * // { data: '' }
 * ```
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

import { loadConfig } from '../config.js';
import type { QueryHandler } from './utils.js';

// ─── agentSkills (config-driven) ────────────────────────────────────────────

export const agentSkills: QueryHandler = async (args, projectDir) => {
  const agentType = (args[0] || '').trim();
  if (!agentType) return { data: '' };

  const config = await loadConfig(projectDir);
  const agentSkillsConfig = config.agent_skills as Record<string, unknown>;
  if (!agentSkillsConfig) return { data: '' };

  let skillPaths = agentSkillsConfig[agentType];
  if (!skillPaths) return { data: '' };

  // Normalize single string to array
  if (typeof skillPaths === 'string') skillPaths = [skillPaths];
  if (!Array.isArray(skillPaths) || skillPaths.length === 0) return { data: '' };

  const globalSkillsBase = join(homedir(), '.claude', 'skills');
  const validPaths: Array<{ ref: string; display: string }> = [];

  for (const skillPath of skillPaths as unknown[]) {
    if (typeof skillPath !== 'string') continue;

    // Support global: prefix for skills installed at ~/.claude/skills/ (#1992)
    if (skillPath.startsWith('global:')) {
      const skillName = skillPath.slice(7);
      if (!skillName) {
        process.stderr.write(`[agent-skills] WARNING: "global:" prefix with empty skill name — skipping\n`);
        continue;
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(skillName)) {
        process.stderr.write(`[agent-skills] WARNING: Invalid global skill name "${skillName}" — skipping\n`);
        continue;
      }
      const globalSkillDir = join(globalSkillsBase, skillName);
      const globalSkillMd = join(globalSkillDir, 'SKILL.md');
      if (!existsSync(globalSkillMd)) {
        process.stderr.write(`[agent-skills] WARNING: Global skill not found at "~/.claude/skills/${skillName}/SKILL.md" — skipping\n`);
        continue;
      }
      // Symlink escape guard: resolved path must stay within globalSkillsBase
      const resolved = resolve(globalSkillMd);
      if (!resolved.startsWith(resolve(globalSkillsBase) + '/') && resolved !== resolve(globalSkillsBase)) {
        process.stderr.write(`[agent-skills] WARNING: Global skill "${skillName}" failed path check (symlink escape?) — skipping\n`);
        continue;
      }
      validPaths.push({ ref: `${globalSkillDir}/SKILL.md`, display: `~/.claude/skills/${skillName}` });
      continue;
    }

    // Path traversal guard: resolved path must stay within projectDir
    const resolvedProject = resolve(projectDir);
    const resolvedSkill = resolve(projectDir, skillPath);
    if (!resolvedSkill.startsWith(resolvedProject + '/') && resolvedSkill !== resolvedProject) {
      process.stderr.write(`[agent-skills] WARNING: Skipping unsafe path "${skillPath}": traversal outside project root\n`);
      continue;
    }

    const skillMdPath = join(projectDir, skillPath, 'SKILL.md');
    if (!existsSync(skillMdPath)) {
      process.stderr.write(`[agent-skills] WARNING: Skill not found at "${skillPath}/SKILL.md" — skipping\n`);
      continue;
    }

    validPaths.push({ ref: `${skillPath}/SKILL.md`, display: skillPath });
  }

  if (validPaths.length === 0) return { data: '' };

  const lines = validPaths.map(p => `- @${p.ref}`).join('\n');
  return { data: `<agent_skills>\nRead these user-configured skills:\n${lines}\n</agent_skills>` };
};

// ─── listSkills (filesystem scan) ───────────────────────────────────────────

export const listSkills: QueryHandler = async (args, projectDir) => {
  const agentType = args[0] || '';
  const skillDirs = [
    join(projectDir, '.claude', 'skills'),
    join(projectDir, '.agents', 'skills'),
    join(projectDir, '.cursor', 'skills'),
    join(projectDir, '.github', 'skills'),
    join(projectDir, '.codex', 'skills'),
    join(homedir(), '.claude', 'skills'),
    join(homedir(), '.codex', 'skills'),
  ];

  const skills: string[] = [];
  for (const dir of skillDirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!existsSync(join(dir, entry.name, 'SKILL.md'))) continue;
        skills.push(entry.name);
      }
    } catch { /* skip unreadable dirs */ }
  }

  const dedupedSkills = [...new Set(skills)];
  return {
    data: {
      agent_type: agentType,
      skills: dedupedSkills,
      skill_count: dedupedSkills.length,
    },
  };
};
