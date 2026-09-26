#!/usr/bin/env node
/**
 * Local verification runner — unit + integration tests.
 * Future CI: npm run verify (exit code 0 = pass)
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const unitOnly = args.includes('--unit');
const integrationOnly = args.includes('--integration');

// Glob patterns, not bare directories: Node 24 treats positional --test args as
// globs and fails to resolve a plain directory path.
const suites = [];
if (!integrationOnly) suites.push('server/tests/unit/**/*.test.js');
if (!unitOnly) suites.push('server/tests/integration/**/*.test.js');

console.log('╔══════════════════════════════════════════╗');
console.log('║       Mertis Local Verification          ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');
console.log(`Running: ${suites.join(', ')}`);
console.log('Docs:    docs/VERIFICATION.md');
console.log('');

// Serial: the integration suites each boot an Express server, and Node 24's
// test runner corrupts its IPC stream ("Unable to deserialize cloned data") when
// several of them report concurrently.
const result = spawnSync(
  process.execPath,
  ['--test', '--test-concurrency=1', ...suites],
  { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', MERTIS_DEV_DEFAULTS: 'true' } }
);

if (result.status === 0) {
  console.log('');
  console.log('✓ Automated verification passed.');
  console.log('  Manual UI checks: docs/VERIFICATION.md § Manual checklist');
} else {
  console.error('');
  console.error('✗ Verification failed (exit', result.status, ')');
}

process.exit(result.status ?? 1);
