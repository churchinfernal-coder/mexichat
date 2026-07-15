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

function normalizeBaseUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
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

export const options = {
  discardResponseBodies: true,
  scenarios: {
    certification: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: stage1Vu },
        { duration: '3m', target: stage2Vu },
        { duration: '3m', target: stage3Vu },
        { duration: '2m', target: 0 },
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
