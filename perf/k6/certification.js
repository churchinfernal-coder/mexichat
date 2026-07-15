import http from 'k6/http';
import { check, sleep } from 'k6';

function mustEnv(name, fallback = '') {
  const value = (__ENV[name] || fallback).trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseNumberEnv(name, fallback) {
  const raw = (__ENV[name] || '').trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return parsed;
}

function parseDurationEnv(name, fallback) {
  const raw = (__ENV[name] || '').trim();
  return raw || fallback;
}

function normalizeBaseUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function assertHttpsUrl(url, envName) {
  const parsed = new URL(url);
  const isLocalhost = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  const allowInsecureLocal = (__ENV.PERF_ALLOW_INSECURE_LOCAL || '').trim() === '1';

  if (parsed.protocol !== 'https:' && !(allowInsecureLocal && isLocalhost)) {
    throw new Error(`${envName} must use https:// (or set PERF_ALLOW_INSECURE_LOCAL=1 for localhost testing)`);
  }
}

function assertRange(name, value, min, max) {
  if (value < min || value > max) {
    throw new Error(`Environment variable ${name} out of range: ${value}. Expected ${min}..${max}`);
  }
}

function assertDuration(name, value) {
  if (!/^\d+(ms|s|m|h)$/.test(value)) {
    throw new Error(`Environment variable ${name} must be a duration like 30s, 2m, 500ms`);
  }
}

const baseUrl = normalizeBaseUrl(mustEnv('PERF_BASE_URL'));
const edgeUrls = (__ENV.EDGE_HEALTH_URLS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const durationP95Ms = parseNumberEnv('PERF_P95_MS', 800);
const durationP99Ms = parseNumberEnv('PERF_P99_MS', 2000);
const maxFailedRate = parseNumberEnv('PERF_MAX_FAILED_RATE', 0.01);
const minCheckRate = parseNumberEnv('PERF_MIN_CHECK_RATE', 0.99);
const stage1Vu = parseNumberEnv('PERF_STAGE1_VUS', 50);
const stage2Vu = parseNumberEnv('PERF_STAGE2_VUS', 200);
const stage3Vu = parseNumberEnv('PERF_STAGE3_VUS', 400);
const stage1Duration = parseDurationEnv('PERF_STAGE1_DURATION', '2m');
const stage2Duration = parseDurationEnv('PERF_STAGE2_DURATION', '3m');
const stage3Duration = parseDurationEnv('PERF_STAGE3_DURATION', '3m');
const stage4Duration = parseDurationEnv('PERF_STAGE4_DURATION', '2m');

assertHttpsUrl(baseUrl, 'PERF_BASE_URL');
for (const url of edgeUrls) {
  assertHttpsUrl(url, 'EDGE_HEALTH_URLS');
}

assertRange('PERF_P95_MS', durationP95Ms, 10, 600000);
assertRange('PERF_P99_MS', durationP99Ms, 10, 600000);
if (durationP99Ms < durationP95Ms) {
  throw new Error('PERF_P99_MS must be greater than or equal to PERF_P95_MS');
}
assertRange('PERF_MAX_FAILED_RATE', maxFailedRate, 0, 1);
assertRange('PERF_MIN_CHECK_RATE', minCheckRate, 0, 1);

assertRange('PERF_STAGE1_VUS', stage1Vu, 1, 50000);
assertRange('PERF_STAGE2_VUS', stage2Vu, 1, 50000);
assertRange('PERF_STAGE3_VUS', stage3Vu, 1, 50000);
assertDuration('PERF_STAGE1_DURATION', stage1Duration);
assertDuration('PERF_STAGE2_DURATION', stage2Duration);
assertDuration('PERF_STAGE3_DURATION', stage3Duration);
assertDuration('PERF_STAGE4_DURATION', stage4Duration);

export const options = {
  discardResponseBodies: true,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    certification: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: stage1Duration, target: stage1Vu },
        { duration: stage2Duration, target: stage2Vu },
        { duration: stage3Duration, target: stage3Vu },
        { duration: stage4Duration, target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: [`rate<${maxFailedRate}`],
    http_req_duration: [`p(95)<${durationP95Ms}`, `p(99)<${durationP99Ms}`],
    checks: [`rate>${minCheckRate}`],
  },
};

const defaultHeaders = {
  'cache-control': 'no-cache',
};

function checkCoreRoute(path) {
  const res = http.get(`${baseUrl}${path}`, {
    tags: { endpoint: path },
    headers: defaultHeaders,
  });

  check(res, {
    [`${path} status acceptable`]: (r) => [200, 304].includes(r.status),
    [`${path} under 5xx`]: (r) => r.status < 500,
  });
}

function checkEdgeHealth(url) {
  const res = http.get(url, {
    tags: { endpoint: 'edge-health' },
    headers: defaultHeaders,
  });

  check(res, {
    'edge health under 5xx': (r) => r.status < 500,
  });
}

export default function () {
  checkCoreRoute('/');
  checkCoreRoute('/manifest.webmanifest');
  checkCoreRoute('/offline.html');
  checkCoreRoute('/robots.txt');

  for (const url of edgeUrls) {
    checkEdgeHealth(url);
  }

  sleep(1);
}
