#!/usr/bin/env node
const { execSync } = require('child_process');
const { readFileSync } = require('fs');
const { resolve } = require('path');

function run(command, label) {
  try {
    const output = execSync(command, { stdio: 'pipe', encoding: 'utf8' });
    return { ok: true, label, output };
  } catch (error) {
    return {
      ok: false,
      label,
      output: error.stdout || '',
      error: error.stderr || error.message,
    };
  }
}

function checkContains(filePath, expected, label) {
  try {
    const text = readFileSync(resolve(filePath), 'utf8');
    const missing = expected.filter((item) => !text.includes(item));
    return {
      ok: missing.length === 0,
      label,
      output: missing.length === 0 ? 'all expected markers present' : `missing markers: ${missing.join(', ')}`,
    };
  } catch (error) {
    return { ok: false, label, output: '', error: error.message };
  }
}

const checks = [];
checks.push(run('npm exec -- eslint src/services/securityGuard.ts src/services/secureStorage.ts src/contexts/AuthContext.tsx src/integrations/supabase/client.ts supabase/functions/send-push/index.ts src/utils/pushNotify.ts src/components/messaging/hooks/useMessages.ts src/utils/encryption-enterprise.ts', 'targeted lint'));
checks.push(run('npm run -s build', 'production build'));

checks.push(checkContains('src/integrations/supabase/client.ts', [
  'createAuthStorage',
  'sessionStorage',
  'clearLegacyLocalAuthArtifacts',
], 'auth storage hardening markers'));

checks.push(checkContains('supabase/functions/send-push/index.ts', [
  'fn_check_push_rate_limit',
  'fn_register_push_idempotency',
  'x-idempotency-key',
], 'push edge hardening markers'));

checks.push(checkContains('src/components/messaging/hooks/useMessages.ts', [
  'E2EE is not ready. Retry after encryption initializes.',
  'E2EE failed: plaintext fallback blocked.',
], 'messaging fail-closed markers'));

const failed = checks.filter((c) => !c.ok);
console.log('=== Deployment Readiness Smoke ===');
for (const check of checks) {
  console.log(`- ${check.ok ? 'PASS' : 'FAIL'}: ${check.label}`);
  if (!check.ok) {
    console.log(`  detail: ${check.error || check.output}`);
  }
}

if (failed.length > 0) {
  process.exit(1);
}
