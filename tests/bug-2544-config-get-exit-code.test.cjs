'use strict';

/**
 * Bug #2544: `gsd-sdk query config-get` exits 0 on missing key.
 *
 * Callers that use `gsd-sdk query config-get k || fallback` rely on a
 * non-zero exit code when the key is absent. The fix changes the
 * ErrorClassification for "Key not found" from Validation (exit 10)
 * to Execution (exit 1), matching the UNIX convention of `git config --get`.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_QUERY_SRC = path.join(
  __dirname, '..', 'sdk', 'src', 'query', 'config-query.ts',
);

describe('gsd-sdk config-get exit code for missing key (#2544)', () => {
  test('config-query.ts source exists', () => {
    assert.ok(fs.existsSync(CONFIG_QUERY_SRC), 'sdk/src/query/config-query.ts must exist');
  });

  test('"Key not found" throws with Execution classification, not Validation', () => {
    const src = fs.readFileSync(CONFIG_QUERY_SRC, 'utf-8');
    // Find the "Key not found" throw lines and confirm they use Execution, not Validation
    const keyNotFoundLines = src
      .split('\n')
      .filter(line => line.includes('Key not found'));
    assert.ok(keyNotFoundLines.length > 0, 'Source must contain "Key not found" throw(s)');
    for (const line of keyNotFoundLines) {
      assert.ok(
        line.includes('Execution'),
        `"Key not found" throw must use ErrorClassification.Execution (exit 1), got: ${line.trim()}`
      );
      assert.ok(
        !line.includes('Validation'),
        `"Key not found" throw must NOT use ErrorClassification.Validation (exit 10), got: ${line.trim()}`
      );
    }
  });
});
