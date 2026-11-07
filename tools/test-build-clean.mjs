/* Test that npm run build leaves a clean git status when nothing changed.
   Run: node tools/test-build-clean.mjs */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const beforeStatus = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });

// Execute build script
execFileSync('node', ['tools/build.mjs'], { stdio: 'pipe' });

const afterStatus = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });

assert.equal(
  afterStatus,
  beforeStatus,
  `npm run build modified files when nothing changed!\nDiff:\n${afterStatus}`
);

console.log('build clean test passed (build is deterministic and leaves clean git status)');

