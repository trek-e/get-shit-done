'use strict';
/**
 * One-shot script: replace retired /gsd:<cmd> with /gsd-<cmd> for known command names.
 * Only replaces when followed by a word boundary (space, newline, quote, backtick, ), end).
 *
 * The transform is exported as a pure function so it can be unit-tested directly
 * (see tests/bug-2543-gsd-slash-namespace.test.cjs) without needing fixture files.
 */

const fs = require('node:fs');
const path = require('node:path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const SEARCH_DIRS = [
  path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib'),
  path.join(__dirname, '..', 'get-shit-done', 'workflows'),
  path.join(__dirname, '..', 'get-shit-done', 'references'),
  path.join(__dirname, '..', 'get-shit-done', 'templates'),
  path.join(__dirname, '..', 'get-shit-done', 'contexts'),
  path.join(__dirname, '..', 'commands', 'gsd'),
];
const EXTENSIONS = new Set(['.md', '.cjs', '.js']);

function buildPattern(cmdNames) {
  const sorted = [...cmdNames].sort((a, b) => b.length - a.length); // longest first to avoid partial matches
  return new RegExp(`/gsd:(${sorted.join('|')})(?=[^a-zA-Z0-9_-]|$)`, 'g');
}

/**
 * Pure transform: rewrite retired `/gsd:<cmd>` to `/gsd-<cmd>` for the given command names.
 * Returns the rewritten string. Identifiers not in `cmdNames` (e.g. `/gsd:sdk`,
 * `/gsd:tools`) are left untouched.
 */
function transformContent(src, cmdNames) {
  const pattern = buildPattern(cmdNames);
  return src.replace(pattern, (_, cmd) => `/gsd-${cmd}`);
}

function readCmdNames() {
  return fs.readdirSync(COMMANDS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace(/\.md$/, ''));
}

function processDir(dir, cmdNames) {
  const pattern = buildPattern(cmdNames);
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      processDir(full, cmdNames);
    } else if (EXTENSIONS.has(path.extname(e.name))) {
      const src = fs.readFileSync(full, 'utf-8');
      const replaced = transformContent(src, cmdNames);
      if (replaced !== src) {
        fs.writeFileSync(full, replaced, 'utf-8');
        const count = (src.match(pattern) || []).length;
        console.log(`  ${count} replacements: ${path.relative(path.join(__dirname, '..'), full)}`);
      }
    }
  }
}

if (require.main === module) {
  const cmdNames = readCmdNames();
  for (const dir of SEARCH_DIRS) {
    processDir(dir, cmdNames);
  }
  console.log('Done.');
}

module.exports = { transformContent, buildPattern };
