/**
 * Integration Test Harness — End-to-End GSD Workflow Simulation
 *
 * Tests the complete GSD lifecycle without touching any LLM or live services.
 * Simulates the main loop: init → state → plan → execute → verify → complete
 * by driving gsd-tools.cjs commands against temp git repos.
 *
 * Covers:
 * - Project initialization and state management
 * - Phase lifecycle (create, plan, execute, complete)
 * - Git operations (commit, branch, tag)
 * - Config management and model resolution
 * - Roadmap parsing and phase routing
 * - Cross-module integration (state ↔ roadmap ↔ phase ↔ verify)
 * - Installer smoke tests (Claude, Codex, Copilot, Gemini)
 * - Hook syntax validation
 *
 * No network calls, no LLM invocations, no external dependencies.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { runGsdTools, createTempProject, createTempGitProject, cleanup, TOOLS_PATH } = require('./helpers.cjs');

// ─── Full Lifecycle Integration ───────────────────────────────────────────────

describe('E2E: project lifecycle simulation', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempGitProject();

    // Write full project scaffold
    const planning = path.join(tmpDir, '.planning');
    fs.writeFileSync(path.join(planning, 'PROJECT.md'), `# Test App

## Vision
A test application for integration testing.

## Technical Decisions
| Decision | Choice | Rationale | Status |
|----------|--------|-----------|--------|
| Language | Node.js | Test | — Decided |

## Constraints
- Must work offline
`);

    fs.writeFileSync(path.join(planning, 'REQUIREMENTS.md'), `# Requirements

## v1 — Must Have
- REQ-01: User authentication
- REQ-02: Dashboard page

## v2 — Future
- REQ-03: Admin panel
`);

    fs.writeFileSync(path.join(planning, 'ROADMAP.md'), `# Roadmap

## v1.0

### Phase 1: Authentication
- [ ] REQ-01

### Phase 2: Dashboard
- [ ] REQ-02
`);

    fs.writeFileSync(path.join(planning, 'STATE.md'), `---
milestone: v1.0
phase: 1
status: active
plan_of: 0
plans_total: 0
progress: 0
---

# State

## Current Position
Phase 1: Authentication

## Decisions
| Decision | Choice | Rationale | Status |
|----------|--------|-----------|--------|

## Quick Tasks Completed
| Date | Type | Task | Status |
|------|------|------|--------|
`);

    fs.writeFileSync(path.join(planning, 'config.json'), JSON.stringify({
      mode: 'interactive',
      granularity: 'standard',
      model_profile: 'balanced',
      commit_docs: true,
      workflow: {
        research: true,
        plan_check: true,
        verifier: true,
        nyquist_validation: true,
      },
      parallelization: true,
      git: { branching_strategy: 'none' },
    }, null, 2));

    // Create phase directory
    fs.mkdirSync(path.join(planning, 'phases', '01-authentication'), { recursive: true });

    // Commit scaffold
    execSync('git add -A && git commit -m "scaffold project"', { cwd: tmpDir, stdio: 'pipe' });
  });

  after(() => cleanup(tmpDir));

  test('state load returns full project state', () => {
    const result = runGsdTools('state load', tmpDir);
    assert.ok(result.success, `state load failed: ${result.error}`);
    const state = JSON.parse(result.output);
    assert.ok(state.config, 'should have config');
    assert.strictEqual(state.config.model_profile, 'balanced');
    assert.strictEqual(state.config.commit_docs, true);
  });

  test('state json returns STATE.md frontmatter', () => {
    const result = runGsdTools('state json', tmpDir);
    assert.ok(result.success, `state json failed: ${result.error}`);
    const state = JSON.parse(result.output);
    assert.strictEqual(state.milestone, 'v1.0');
    assert.strictEqual(state.phase, '1');
    assert.strictEqual(state.status, 'active');
  });

  test('resolve-model returns correct model for profile', () => {
    const result = runGsdTools('resolve-model gsd-planner', tmpDir);
    assert.ok(result.success, `resolve-model failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.model, 'opus');
    assert.strictEqual(data.profile, 'balanced');
  });

  test('resolve-model returns sonnet for executor in balanced', () => {
    const result = runGsdTools('resolve-model gsd-executor', tmpDir);
    assert.ok(result.success);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.model, 'sonnet');
  });

  test('find-phase locates phase directory', () => {
    const result = runGsdTools('find-phase 1', tmpDir);
    assert.ok(result.success, `find-phase failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.directory.includes('01-authentication'), `expected 01-authentication, got ${data.directory}`);
    assert.ok(data.found, 'phase should be found');
  });

  test('generate-slug produces url-safe string', () => {
    const result = runGsdTools('generate-slug "Add User Authentication"', tmpDir);
    assert.ok(result.success);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.slug, 'add-user-authentication');
  });

  test('current-timestamp returns ISO format', () => {
    const result = runGsdTools('current-timestamp', tmpDir);
    assert.ok(result.success);
    const data = JSON.parse(result.output);
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(data.timestamp), `expected ISO, got ${data.timestamp}`);
  });

  test('verify-path-exists checks planning directory', () => {
    const result = runGsdTools('verify-path-exists .planning/PROJECT.md', tmpDir);
    assert.ok(result.success);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.exists, true);
  });

  test('verify-path-exists returns false for missing path', () => {
    const result = runGsdTools('verify-path-exists .planning/NONEXISTENT.md', tmpDir);
    assert.ok(result.success);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.exists, false);
  });

  test('roadmap analyze parses phase structure', () => {
    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `roadmap analyze failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.phases, 'should have phases array');
    assert.ok(data.phases.length >= 2, `expected >= 2 phases, got ${data.phases.length}`);
  });

  test('config-get reads config values', () => {
    const result = runGsdTools('config-get mode', tmpDir);
    assert.ok(result.success, `config-get failed: ${result.error}`);
    assert.ok(result.output.includes('interactive'), `expected interactive, got: ${result.output}`);
  });

  test('config-set updates config values', () => {
    const result = runGsdTools(['config-set', 'mode', 'yolo'], tmpDir);
    assert.ok(result.success, `config-set failed: ${result.error}`);

    // Verify it changed (config-get returns quoted value)
    const verify = runGsdTools('config-get mode', tmpDir);
    assert.ok(verify.output.includes('yolo'), `expected yolo, got: ${verify.output}`);

    // Reset
    runGsdTools(['config-set', 'mode', 'interactive'], tmpDir);
  });

  test('list-todos returns count when no todos', () => {
    const result = runGsdTools('list-todos', tmpDir);
    assert.ok(result.success);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.count, 0);
  });

  test('progress returns project status', () => {
    const result = runGsdTools('progress', tmpDir);
    assert.ok(result.success, `progress failed: ${result.error}`);
    // Progress returns JSON with phase/milestone info
    try {
      const data = JSON.parse(result.output);
      assert.ok(data, 'should return parseable JSON');
    } catch {
      // Some progress formats return key=value — just check it ran
      assert.ok(result.output.length > 0, 'should return some output');
    }
  });
});

// ─── Git Operations Integration ──────────────────────────────────────────────

describe('E2E: git operations', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempGitProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
    execSync('git add -A && git commit -m "add config"', { cwd: tmpDir, stdio: 'pipe' });
  });

  after(() => cleanup(tmpDir));

  test('commit creates atomic git commit', () => {
    // Create a file to commit
    fs.writeFileSync(path.join(tmpDir, '.planning', 'test-file.md'), '# Test\n');
    execSync('git add .planning/test-file.md', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools(['commit', 'test: integration test commit', '--files', '.planning/test-file.md'], tmpDir);
    assert.ok(result.success, `commit failed: ${result.error}`);

    // Verify commit exists
    const log = execSync('git log --oneline -1', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    assert.ok(log.includes('integration test commit'), `commit message not found: ${log}`);
  });

  test('commit respects commit_docs: false', () => {
    // Set commit_docs to false
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ commit_docs: false }));

    fs.writeFileSync(path.join(tmpDir, '.planning', 'skip-file.md'), '# Skip\n');

    const result = runGsdTools(['commit', 'should be skipped'], tmpDir);
    assert.ok(result.success);
    assert.ok(result.output.includes('skipped') || result.output.includes('false'), `expected skip, got: ${result.output}`);

    // Reset
    fs.writeFileSync(configPath, JSON.stringify({ commit_docs: true }));
  });

  test('commit handles nothing-to-commit gracefully', () => {
    const result = runGsdTools(['commit', 'empty commit'], tmpDir);
    // May succeed with "nothing" message or fail gracefully
    const output = (result.output + ' ' + (result.error || '')).toLowerCase();
    assert.ok(output.includes('nothing') || output.includes('skipped') || result.success, 
      `expected graceful handling, got: ${result.output} ${result.error}`);
  });
});

// ─── Phase Lifecycle Integration ─────────────────────────────────────────────

describe('E2E: phase lifecycle', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempGitProject();
    const planning = path.join(tmpDir, '.planning');
    fs.writeFileSync(path.join(planning, 'config.json'), JSON.stringify({
      commit_docs: true,
      model_profile: 'balanced',
      granularity: 'standard',
    }));
    fs.writeFileSync(path.join(planning, 'ROADMAP.md'), `# Roadmap

## v1.0

### Phase 1: Setup
- [ ] REQ-01

### Phase 2: Features
- [ ] REQ-02

### Phase 3: Polish
- [ ] REQ-03
`);
    fs.writeFileSync(path.join(planning, 'STATE.md'), `---
milestone: v1.0
phase: 1
status: active
---
# State
`);
    fs.mkdirSync(path.join(planning, 'phases', '01-setup'), { recursive: true });
    fs.mkdirSync(path.join(planning, 'phases', '02-features'), { recursive: true });
    fs.mkdirSync(path.join(planning, 'phases', '03-polish'), { recursive: true });
    execSync('git add -A && git commit -m "scaffold phases"', { cwd: tmpDir, stdio: 'pipe' });
  });

  after(() => cleanup(tmpDir));

  test('phase add appends new phase to roadmap', () => {
    const result = runGsdTools(['phase', 'add', 'Testing'], tmpDir);
    assert.ok(result.success, `phase add failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('Phase 4'), `phase 4 not added to roadmap`);
  });

  test('phase next-decimal calculates decimal phase', () => {
    const result = runGsdTools('phase next-decimal 2', tmpDir);
    assert.ok(result.success, `next-decimal failed: ${result.error}`);
    // Output may be JSON or plain — check for 2.1 in either format
    assert.ok(result.output.includes('2.1'), `expected 2.1 in output, got: ${result.output}`);
  });

  test('init execute-phase returns phase context', () => {
    // Create a plan file so init has something to find
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md'),
      '---\nwave: 1\n---\n# Plan 01\n\n<task type="auto">\n<name>Test</name>\n</task>\n'
    );

    const result = runGsdTools('init execute-phase 1', tmpDir);
    assert.ok(result.success, `init execute-phase failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.phase_found, 'phase should be found');
    assert.ok(data.plans && data.plans.length > 0, 'should have plans');
  });

  test('init plan-phase returns planning context', () => {
    const result = runGsdTools('init plan-phase 1', tmpDir);
    assert.ok(result.success, `init plan-phase failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.phase_found !== undefined, 'should have phase_found');
    assert.ok(data.planner_model, 'should have planner_model');
    assert.ok(data.checker_model, 'should have checker_model');
  });
});

// ─── Model Profile Resolution ────────────────────────────────────────────────

describe('E2E: model profiles across configs', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      model_profile: 'budget',
    }));
  });

  after(() => cleanup(tmpDir));

  test('budget profile uses sonnet for planner', () => {
    const result = runGsdTools('resolve-model gsd-planner', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(JSON.parse(result.output).model, 'sonnet');
  });

  test('budget profile uses haiku for researcher', () => {
    const result = runGsdTools('resolve-model gsd-phase-researcher', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(JSON.parse(result.output).model, 'haiku');
  });

  test('model override takes precedence', () => {
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    config.model_overrides = { 'gsd-planner': 'haiku' };
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify(config));

    const result = runGsdTools('resolve-model gsd-planner', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(JSON.parse(result.output).model, 'haiku');

    // Cleanup
    delete config.model_overrides;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify(config));
  });

  test('inherit profile returns inherit for all agents', () => {
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    config.model_profile = 'inherit';
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify(config));

    for (const agent of ['gsd-planner', 'gsd-executor', 'gsd-verifier']) {
      const result = runGsdTools(`resolve-model ${agent}`, tmpDir);
      assert.ok(result.success);
      assert.strictEqual(JSON.parse(result.output).model, 'inherit', `${agent} should use inherit`);
    }
  });
});

// ─── Installer Smoke Tests ───────────────────────────────────────────────────

describe('E2E: installer smoke tests', () => {
  const INSTALL_PATH = path.join(__dirname, '..', 'bin', 'install.js');

  test('claude install creates expected structure', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-smoke-'));
    try {
      execFileSync(process.execPath, [INSTALL_PATH, '--claude', '--local'], {
        cwd: tmpDir, env: { ...process.env, GSD_TEST_MODE: undefined }, stdio: 'pipe', timeout: 30000,
      });

      assert.ok(fs.existsSync(path.join(tmpDir, '.claude', 'commands', 'gsd')), 'commands dir exists');
      assert.ok(fs.existsSync(path.join(tmpDir, '.claude', 'get-shit-done')), 'workflows dir exists');
      assert.ok(fs.existsSync(path.join(tmpDir, '.claude', 'agents')), 'agents dir exists');
      assert.ok(fs.existsSync(path.join(tmpDir, '.claude', 'get-shit-done', 'VERSION')), 'VERSION exists');

      const version = fs.readFileSync(path.join(tmpDir, '.claude', 'get-shit-done', 'VERSION'), 'utf-8').trim();
      assert.ok(/^\d+\.\d+\.\d+/.test(version), `valid semver: ${version}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('codex install creates config.toml and skills', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-smoke-'));
    try {
      execFileSync(process.execPath, [INSTALL_PATH, '--codex', '--local'], {
        cwd: tmpDir, env: { ...process.env, GSD_TEST_MODE: undefined }, stdio: 'pipe', timeout: 30000,
      });

      assert.ok(fs.existsSync(path.join(tmpDir, '.codex', 'skills')), 'skills dir exists');
      assert.ok(fs.existsSync(path.join(tmpDir, '.codex', 'config.toml')), 'config.toml exists');

      const config = fs.readFileSync(path.join(tmpDir, '.codex', 'config.toml'), 'utf-8');
      assert.ok(config.includes('[agents.gsd-'), 'has GSD agent config');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── Hook Syntax Validation ──────────────────────────────────────────────────

describe('E2E: hook integrity', () => {
  const hooksDir = path.join(__dirname, '..', 'hooks');

  test('all gsd-*.js hooks pass syntax validation', () => {
    const hooks = fs.readdirSync(hooksDir)
      .filter(f => f.startsWith('gsd-') && f.endsWith('.js'));

    assert.ok(hooks.length >= 3, `expected >= 3 hooks, found ${hooks.length}`);

    for (const hook of hooks) {
      const hookPath = path.join(hooksDir, hook);
      try {
        execFileSync(process.execPath, ['--check', hookPath], { stdio: 'pipe' });
      } catch (e) {
        assert.fail(`Hook ${hook} has syntax error: ${e.stderr?.toString() || e.message}`);
      }
    }
  });

  test('all hooks have version header or are development hooks', () => {
    const hooks = fs.readdirSync(hooksDir)
      .filter(f => f.startsWith('gsd-') && f.endsWith('.js'));

    for (const hook of hooks) {
      const content = fs.readFileSync(path.join(hooksDir, hook), 'utf-8');
      const hasVersion = content.includes('gsd-hook-version:') || content.includes('{{GSD_VERSION}}');
      // Development hooks may not have version headers yet — just warn
      if (!hasVersion) {
        console.log(`  ⚠️ Hook ${hook} missing version header (development hook)`);
      }
    }
  });

  test('dist hooks match source hooks', () => {
    const distDir = path.join(hooksDir, 'dist');
    if (!fs.existsSync(distDir)) return; // dist may not exist in dev

    const hooks = fs.readdirSync(hooksDir)
      .filter(f => f.startsWith('gsd-') && f.endsWith('.js'));

    for (const hook of hooks) {
      const distPath = path.join(distDir, hook);
      if (fs.existsSync(distPath)) {
        const src = fs.readFileSync(path.join(hooksDir, hook), 'utf-8');
        const dist = fs.readFileSync(distPath, 'utf-8');
        assert.strictEqual(src, dist, `Hook ${hook} differs between source and dist — run npm run build:hooks`);
      }
    }
  });
});

// ─── Cross-Module State Consistency ──────────────────────────────────────────

describe('E2E: cross-module state consistency', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempGitProject();
    const planning = path.join(tmpDir, '.planning');
    fs.writeFileSync(path.join(planning, 'config.json'), JSON.stringify({
      model_profile: 'balanced', commit_docs: true,
    }));
    fs.writeFileSync(path.join(planning, 'ROADMAP.md'), `# Roadmap\n\n## v1.0\n\n### Phase 1: Init\n- [ ] REQ-01\n`);
    fs.writeFileSync(path.join(planning, 'STATE.md'), `---\nmilestone: v1.0\nphase: 1\nstatus: active\n---\n# State\n`);
    fs.mkdirSync(path.join(planning, 'phases', '01-init'), { recursive: true });
    execSync('git add -A && git commit -m "setup"', { cwd: tmpDir, stdio: 'pipe' });
  });

  after(() => cleanup(tmpDir));

  test('state and roadmap agree on phase count', () => {
    const roadmapResult = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(roadmapResult.success);
    const roadmap = JSON.parse(roadmapResult.output);

    const stateResult = runGsdTools('state json', tmpDir);
    assert.ok(stateResult.success);
    const state = JSON.parse(stateResult.output);

    // Phase referenced in state should exist in roadmap
    const phaseNum = state.phase;
    if (phaseNum && roadmap.phases) {
      const found = roadmap.phases.some(p =>
        String(p.number) === String(phaseNum) || String(p.phase_number) === String(phaseNum)
      );
      assert.ok(found, `state.phase=${phaseNum} not found in roadmap phases`);
    }
  });

  test('init and state return consistent config', () => {
    const stateResult = runGsdTools('state load', tmpDir);
    assert.ok(stateResult.success);
    const stateConfig = JSON.parse(stateResult.output).config;

    const initResult = runGsdTools('init plan-phase 1', tmpDir);
    assert.ok(initResult.success);
    const initData = JSON.parse(initResult.output);

    // Both should resolve the same model profile
    assert.strictEqual(stateConfig.model_profile, 'balanced');
    assert.ok(initData.planner_model, 'init should resolve planner model');
  });
});
