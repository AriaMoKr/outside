// The page's modules type-checked as they are served (tsconfig.json: from their JSDoc, strictly,
// nothing built), and tools/ and test/ as strictly with Node's types (tsconfig.node.json), as the
// template's test/types.test.js runs tsc: a failure shows tsc's own output. TypeScript is a
// devDependency here, so not finding it fails rather than skips.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * What execFileSync throws: an Error with the run's result (spawnSync's), its output as text.
 * @typedef {Error & import('node:child_process').SpawnSyncReturns<string>} ExecError
 */

/**
 * tsc on a project, failing with what it found.
 * @param {string} project its tsconfig
 */
function check(project) {
  let tsc;
  try {
    tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  } catch {
    assert.fail('TypeScript is not installed: npm install');
  }
  try {
    execFileSync(process.execPath, [tsc, '-p', project, '--pretty', 'false'], { cwd: here, encoding: 'utf8' });
  } catch (e) {
    assert.fail(`tsc -p ${project}\n${/** @type {ExecError} */ (e).stdout}${/** @type {ExecError} */ (e).stderr}`); // execFileSync's
  }
}

test('public/js/ type-checks strictly: tsc -p tsconfig.json finds nothing', () => check('tsconfig.json'));

test('tools/ and test/ type-check strictly: tsc -p tsconfig.node.json finds nothing', () => check('tsconfig.node.json'));
