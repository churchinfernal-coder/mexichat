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

checks.push(run(
  'npm exec -- eslint supabase/functions/send-push/index.ts supabase/functions/payment-send/index.ts src/utils/pushNotify.ts',
  'edge security lint'
));

checks.push(checkContains('supabase/functions/send-push/index.ts', [
  'fn_check_push_rate_limit',
  'fn_register_push_idempotency',
  'resolveCorsHeaders',
  'Authorization',
  'x-idempotency-key',
], 'send-push hardening markers'));

checks.push(checkContains('supabase/migrations/20260713153000_push_replay_rate_limit.sql', [
  'CREATE TABLE IF NOT EXISTS public.push_request_limits',
  'CREATE TABLE IF NOT EXISTS public.push_idempotency_keys',
  'fn_check_push_rate_limit',
  'fn_register_push_idempotency',
], 'push replay/rate-limit migration markers'));

checks.push(checkContains('src/utils/pushNotify.ts', [
  'x-idempotency-key',
  'send-push',
], 'client push idempotency markers'));

checks.push(checkContains('supabase/functions/payment-send/index.ts', [
  'idempotency_key',
  'transactions',
  'provider_data',
], 'payment edge idempotency markers'));

const failed = checks.filter((c) => !c.ok);
console.log('=== Edge Security Smoke ===');
for (const check of checks) {
  console.log(`- ${check.ok ? 'PASS' : 'FAIL'}: ${check.label}`);
  if (!check.ok) {
    console.log(`  detail: ${check.error || check.output}`);
  }
}

if (failed.length > 0) {
  process.exit(1);
}
