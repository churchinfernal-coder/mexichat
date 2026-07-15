#!/usr/bin/env node
const { execSync } = require('child_process');

function run(command, label) {
  process.stdout.write(`=== ${label} ===\n`);
  execSync(command, { stdio: 'inherit' });
}

try {
  run('npm run -s smoke:deploy', 'Deployment Readiness Smoke');
  run('npm run -s smoke:edge-security', 'Edge Security Smoke');
  console.log('=== Release Readiness Smoke ===');
  console.log('- PASS: all smoke gates');
} catch (error) {
  console.error('=== Release Readiness Smoke ===');
  console.error('- FAIL: one or more smoke gates failed');
  process.exitCode = error.status || 1;
}
