#!/usr/bin/env node
/**
 * Copy GSD hooks to dist for installation.
 * Runs via prepublishOnly to ensure hooks/dist/ is always fresh before npm publish.
 */

const fs = require('fs');
const path = require('path');

const HOOKS_DIR = path.join(__dirname, '..', 'hooks');
const DIST_DIR = path.join(HOOKS_DIR, 'dist');

// Hooks to copy (pure Node.js, no bundling needed)
const HOOKS_TO_COPY = [
  'gsd-check-update.js',
  'gsd-context-monitor.js',
  'gsd-statusline.js'
];

function build() {
  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  let errors = 0;

  // Copy hooks to dist
  for (const hook of HOOKS_TO_COPY) {
    const src = path.join(HOOKS_DIR, hook);
    const dest = path.join(DIST_DIR, hook);

    if (!fs.existsSync(src)) {
      console.warn(`Warning: ${hook} not found, skipping`);
      continue;
    }

    console.log(`Copying ${hook}...`);
    fs.copyFileSync(src, dest);
    console.log(`  → ${dest}`);

    // Validate: check for syntax errors using Node's --check flag
    const { spawnSync } = require('child_process');
    const check = spawnSync(process.execPath, ['--check', dest], { stdio: 'pipe', encoding: 'utf8' });
    if (check.status !== 0) {
      console.error(`  ✗ SYNTAX ERROR in ${hook}: ${(check.stderr || '').trim()}`);
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`\nBuild failed: ${errors} hook(s) have syntax errors.`);
    process.exit(1);
  }

  console.log('\nBuild complete.');
}

build();
