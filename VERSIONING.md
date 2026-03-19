# Versioning & Branching Strategy

> GitOps-driven versioning with automated branch management for GSD.

## Semantic Versioning

GSD follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH[-prerelease]

1.27.0        — next feature release
1.26.1        — patch fix on current release
2.0.0         — breaking change (runtime API, config format, CLI flags)
1.27.0-beta.1 — pre-release for testing
```

| Increment | When | Examples |
|-----------|------|----------|
| **PATCH** (1.26.x) | Bug fixes, typos, doc corrections, test additions | Hook filter fix, config.toml corruption fix |
| **MINOR** (1.x.0) | New features, new commands, non-breaking enhancements | `/gsd:review`, `/gsd:plant-seed`, new runtime support |
| **MAJOR** (x.0.0) | Breaking changes to config format, CLI flags, or runtime API | Removing a command, changing config schema, dropping Node version |

## Branch Structure

```
main                          ← production, always deployable
  │
  ├── release/1.27.0          ← release candidate branch (created automatically)
  │     ├── fix/1200-stale-hooks
  │     └── feat/review-command
  │
  ├── release/1.26.1          ← hotfix release branch
  │     └── fix/1202-codex-toml
  │
  ├── develop                 ← integration branch for next minor (optional)
  │
  ├── fix/*                   ← bug fix branches
  │     ├── fix/1200-stale-hooks-filter
  │     └── fix/1202-codex-config-toml
  │
  └── feat/*                  ← feature branches
        ├── feat/review-command
        ├── feat/plant-seed
        └── feat/cicd-pipeline
```

### Branch Types

| Prefix | Purpose | Base | Merges Into | Auto-created |
|--------|---------|------|-------------|-------------|
| `main` | Production | — | — | — |
| `develop` | Next minor integration | `main` | `release/*` | No |
| `release/X.Y.Z` | Release candidate | `main` or `develop` | `main` | Yes (on milestone) |
| `fix/*` | Bug fixes | `main` | `release/X.Y.Z` or `main` | Yes (on issue label) |
| `feat/*` | Features | `main` or `develop` | `release/X.Y.Z` or `develop` | Yes (on issue label) |
| `hotfix/*` | Critical production fixes | `main` | `main` + `develop` | Yes (on `priority: critical` label) |
| `chore/*` | Maintenance, refactoring | `main` | `main` | No |
| `docs/*` | Documentation only | `main` | `main` | No |

## Automated Branch Creation

When an issue is labeled, a branch is automatically created:

| Issue Label | Branch Created | Base Branch |
|-------------|---------------|-------------|
| `bug` | `fix/{number}-{slug}` | `main` |
| `enhancement` | `feat/{number}-{slug}` | `main` |
| `priority: critical` | `hotfix/{number}-{slug}` | `main` |
| `type: chore` | `chore/{number}-{slug}` | `main` |
| `area: docs` | `docs/{number}-{slug}` | `main` |

### How it works

1. Contributor opens issue → maintainer adds label (`bug`, `enhancement`, etc.)
2. GitHub Action auto-creates a branch with the correct prefix and naming
3. Contributor checks out the branch and works
4. PR is opened against the appropriate target (main or release branch)
5. CI runs, reviews happen, merge when ready

## Release Train

### Minor Release (1.27.0)

```
1. Features and fixes accumulate on main (or develop)
2. When ready, create release branch:
   → release/1.27.0 is auto-created via workflow dispatch
3. Only bug fixes go into release/1.27.0
4. Release candidate testing:
   → v1.27.0-rc.1 tag → npm publish --tag next
5. When stable:
   → Merge release/1.27.0 → main
   → Tag v1.27.0 → npm publish --tag latest
   → Delete release branch
```

### Patch Release (1.26.1)

```
1. Critical fix needed on current production
2. Create hotfix branch from main:
   → hotfix/1202-codex-config-toml
3. Fix, test, PR against main
4. Merge → tag v1.26.1 → npm publish
5. If develop exists, cherry-pick fix into develop
```

### Pre-release (1.27.0-beta.1)

```
1. Experimental features ready for testing
2. Tag from release branch or main:
   → v1.27.0-beta.1
3. Publish to npm with --tag next:
   → npm install get-shit-done-cc@next
4. Gather feedback → iterate → promote to stable
```

## Commit Convention

All commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

feat(review): add cross-AI peer review command
fix(hooks): filter stale check to gsd-prefixed files only
docs(readme): update command table for v1.27
chore(ci): update Node matrix to 20, 22, 24
refactor(core): adopt planningPaths() across modules
test(integration): add E2E lifecycle harness
```

| Type | Version Bump | Description |
|------|-------------|-------------|
| `feat` | MINOR | New feature |
| `fix` | PATCH | Bug fix |
| `docs` | — | Documentation only |
| `chore` | — | Maintenance, deps |
| `refactor` | — | Code restructure |
| `test` | — | Test additions |
| `perf` | PATCH | Performance improvement |
| `ci` | — | CI/CD changes |

### Breaking Changes

Append `!` or add `BREAKING CHANGE:` footer:

```
feat(config)!: rename depth to granularity

BREAKING CHANGE: config.depth is now config.granularity.
Existing configs are auto-migrated.
```

## Version Lifecycle

```
v1.26.0 (current stable)
  │
  ├── v1.26.1 (hotfix if needed)
  │
  ├── v1.27.0-rc.1 (release candidate)
  ├── v1.27.0-rc.2 (fixes from RC testing)
  ├── v1.27.0 (stable release)
  │
  ├── v1.28.0-beta.1 (experimental features)
  ├── v1.28.0 (next minor)
  │
  └── v2.0.0 (if breaking changes needed)
```

## npm Distribution Tags

| Tag | Purpose | Install Command |
|-----|---------|----------------|
| `latest` | Stable release | `npx get-shit-done-cc@latest` |
| `next` | Pre-release/RC | `npx get-shit-done-cc@next` |
| `beta` | Experimental | `npx get-shit-done-cc@beta` |

## For Contributors

1. **Check the issue** — Is there already a branch? Check the issue comments for an auto-created branch link.
2. **Use the right prefix** — `fix/` for bugs, `feat/` for features, `docs/` for documentation.
3. **Follow commit convention** — `type(scope): description` format.
4. **Target the right branch** — PRs go to `main` unless there's an active `release/*` branch.
5. **One concern per PR** — Don't mix features and bug fixes in the same PR.

## For Maintainers

1. **Label issues promptly** — Branch auto-creation triggers on label.
2. **Create release branches** — Use the workflow dispatch when features are ready.
3. **Tag releases** — Push `v*` tag to trigger the release pipeline.
4. **Review before publish** — The `npm-publish` environment requires human approval.

---

## Pipeline Integration

This versioning strategy is designed to work with the CI/CD/Release pipeline (PR #1208).
Together they form the complete development lifecycle:

### How the pieces fit

```
Issue filed
  │
  ├── Label added (bug/enhancement/critical)
  │     └── auto-branch.yml creates fix/123-slug or feat/123-slug
  │
  ├── Contributor works on branch
  │     └── branch-naming.yml validates prefix on PR open
  │
  ├── PR opened against main
  │     ├── ci.yml: lint → test (9-matrix) → security → install-smoke
  │     ├── pr-gate.yml: size analysis, command-workflow validation
  │     └── Integration test harness runs (E2E lifecycle, git ops, installs)
  │
  ├── PR merged to main
  │     └── cd.yml: detects version bump in package.json → auto-tags → triggers release
  │
  ├── Release train (manual or auto)
  │     ├── release-train.yml: create-release-branch → promote-rc → finalize
  │     └── release.yml: validate → ⏸️ HUMAN APPROVAL → npm publish → GitHub Release → verify
  │
  └── Post-release
        ├── verify-release: npm propagation check + install smoke test
        └── stale.yml: weekly cleanup of inactive PRs/issues
```

### Workflow files

| File | Purpose | From |
|------|---------|------|
| `ci.yml` | Test matrix, lint, security, smoke tests | PR #1208 |
| `release.yml` | Validate, publish npm, GitHub Release, verify | PR #1208 |
| `cd.yml` | Auto-tag on version bump → trigger release | PR #1208 |
| `pr-gate.yml` | PR size analysis, command/agent validation | PR #1208 |
| `stale.yml` | Weekly cleanup of stale PRs/issues | PR #1208 |
| `auto-branch.yml` | Create branch on issue label | This PR |
| `release-train.yml` | Release branch management (create, RC, finalize) | This PR |
| `branch-naming.yml` | Validate branch prefix convention | This PR |
| `auto-label-issues.yml` | Add needs-triage to new issues | Existing |
| `test.yml` | Legacy test runner (superseded by ci.yml) | Existing |

### Required setup

1. **GitHub Environments**: Create `npm-publish` with required reviewers (human approval gate)
2. **Secrets**: Add `NPM_TOKEN` to the `npm-publish` environment
3. **Branch protection**: Require `ci / lint`, `ci / test`, `pr-gate / pr-review` checks
4. **Dependabot**: Already configured via `.github/dependabot.yml` (PR #1208)

