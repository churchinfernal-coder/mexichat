#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function usage() {
  console.error('Usage: node scripts/perf-certification-evidence.cjs <summary.json> <evidence.json> <evidence.md>');
  process.exit(2);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Summary file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return {
    raw,
    parsed: JSON.parse(raw),
  };
}

function getMetricValue(metrics, metricName, valueName, fallback = null) {
  const metric = metrics?.[metricName];
  if (!metric) return fallback;
  if (Object.prototype.hasOwnProperty.call(metric, valueName)) {
    return metric[valueName];
  }
  if (metric.values && Object.prototype.hasOwnProperty.call(metric.values, valueName)) {
    return metric.values[valueName];
  }
  // In recent k6 exports, rate-like metrics use `value`.
  if (valueName === 'rate' && Object.prototype.hasOwnProperty.call(metric, 'value')) {
    return metric.value;
  }
  return fallback;
}

function evaluateComparator(left, operator, right) {
  switch (operator) {
    case '<': return left < right;
    case '<=': return left <= right;
    case '>': return left > right;
    case '>=': return left >= right;
    default: return null;
  }
}

function evaluateThreshold(metrics, metricName, thresholdExpr) {
  const rateMatch = thresholdExpr.match(/^rate\s*(<=|>=|<|>)\s*([+-]?[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?)$/i);
  if (rateMatch) {
    const [, operator, valueRaw] = rateMatch;
    const left = getMetricValue(metrics, metricName, 'rate', null);
    const right = Number(valueRaw);
    if (typeof left === 'number' && Number.isFinite(left) && Number.isFinite(right)) {
      return { passed: evaluateComparator(left, operator, right), observed: left, expected: right, operator };
    }
    return { passed: null, observed: left, expected: right, operator };
  }

  const percentileMatch = thresholdExpr.match(/^p\((\d+)\)\s*(<=|>=|<|>)\s*([+-]?[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?)$/i);
  if (percentileMatch) {
    const [, percentileRaw, operator, valueRaw] = percentileMatch;
    const key = `p(${percentileRaw})`;
    const left = getMetricValue(metrics, metricName, key, null);
    const right = Number(valueRaw);
    if (typeof left === 'number' && Number.isFinite(left) && Number.isFinite(right)) {
      return { passed: evaluateComparator(left, operator, right), observed: left, expected: right, operator };
    }
    return { passed: null, observed: left, expected: right, operator };
  }

  return { passed: null, observed: null, expected: null, operator: null };
}

function collectThresholds(metrics) {
  const rows = [];
  for (const [metricName, metric] of Object.entries(metrics || {})) {
    const thresholds = metric?.thresholds || {};
    for (const [thresholdExpr, rawStatus] of Object.entries(thresholds)) {
      const computed = evaluateThreshold(metrics, metricName, thresholdExpr);
      const rawStatusBool = rawStatus === true;
      const passed = typeof computed.passed === 'boolean' ? computed.passed : rawStatusBool;
      const evaluationSource = typeof computed.passed === 'boolean' ? 'computed' : 'k6-raw';
      rows.push({
        metric: metricName,
        threshold: thresholdExpr,
        passed,
        observed: toFixedMaybe(computed.observed, 6),
        expected: toFixedMaybe(computed.expected, 6),
        operator: computed.operator,
        evaluationSource,
      });
    }
  }
  return rows;
}

function toFixedMaybe(value, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function buildEvidence(summaryBundle) {
  const metrics = summaryBundle.parsed.metrics || {};
  const thresholds = collectThresholds(metrics);

  if (thresholds.length === 0) {
    throw new Error('No threshold evaluations found in k6 summary. Ensure k6 thresholds are defined.');
  }

  const failedThresholds = thresholds.filter((t) => !t.passed);
  const passed = failedThresholds.length === 0;

  const summarySha256 = crypto
    .createHash('sha256')
    .update(summaryBundle.raw, 'utf8')
    .digest('hex');

  return {
    generatedAtUtc: new Date().toISOString(),
    result: passed ? 'PASS' : 'FAIL',
    context: {
      githubRunId: process.env.GITHUB_RUN_ID || null,
      githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
      githubSha: process.env.GITHUB_SHA || null,
      githubRef: process.env.GITHUB_REF || null,
    },
    integrity: {
      summarySha256,
    },
    totals: {
      thresholds: thresholds.length,
      failedThresholds: failedThresholds.length,
    },
    traffic: {
      httpRequests: toFixedMaybe(getMetricValue(metrics, 'http_reqs', 'count'), 0),
      requestsPerSecond: toFixedMaybe(getMetricValue(metrics, 'http_reqs', 'rate'), 2),
      checksPassRate: toFixedMaybe(getMetricValue(metrics, 'checks', 'rate'), 4),
      failedRate: toFixedMaybe(getMetricValue(metrics, 'http_req_failed', 'rate'), 4),
    },
    latencyMs: {
      p50: toFixedMaybe(getMetricValue(metrics, 'http_req_duration', 'med')),
      p95: toFixedMaybe(getMetricValue(metrics, 'http_req_duration', 'p(95)')),
      p99: toFixedMaybe(getMetricValue(metrics, 'http_req_duration', 'p(99)')),
      max: toFixedMaybe(getMetricValue(metrics, 'http_req_duration', 'max')),
    },
    thresholds,
  };
}

function buildErrorEvidence(error) {
  return {
    generatedAtUtc: new Date().toISOString(),
    result: 'ERROR',
    context: {
      githubRunId: process.env.GITHUB_RUN_ID || null,
      githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
      githubSha: process.env.GITHUB_SHA || null,
      githubRef: process.env.GITHUB_REF || null,
    },
    error: {
      message: String(error && error.message ? error.message : error),
    },
    totals: {
      thresholds: 0,
      failedThresholds: 0,
    },
    traffic: {
      httpRequests: null,
      requestsPerSecond: null,
      checksPassRate: null,
      failedRate: null,
    },
    latencyMs: {
      p50: null,
      p95: null,
      p99: null,
      max: null,
    },
    thresholds: [],
  };
}

function renderMarkdown(evidence) {
  const lines = [];
  lines.push('# Performance Certification Evidence');
  lines.push('');
  lines.push(`- Result: **${evidence.result}**`);
  lines.push(`- Generated (UTC): ${evidence.generatedAtUtc}`);
  if (evidence.context) {
    lines.push(`- GitHub run: ${evidence.context.githubRunId || 'n/a'} (attempt ${evidence.context.githubRunAttempt || 'n/a'})`);
    lines.push(`- Git ref: ${evidence.context.githubRef || 'n/a'}`);
    lines.push(`- Git SHA: ${evidence.context.githubSha || 'n/a'}`);
  }
  if (evidence.integrity?.summarySha256) {
    lines.push(`- Summary SHA-256: ${evidence.integrity.summarySha256}`);
  }
  lines.push(`- Thresholds: ${evidence.totals.thresholds}`);
  lines.push(`- Failed thresholds: ${evidence.totals.failedThresholds}`);
  if (evidence.error?.message) {
    lines.push(`- Error: ${evidence.error.message}`);
  }
  lines.push('');
  lines.push('## Traffic');
  lines.push('');
  lines.push(`- HTTP requests: ${evidence.traffic.httpRequests}`);
  lines.push(`- Requests/sec: ${evidence.traffic.requestsPerSecond}`);
  lines.push(`- Checks pass rate: ${evidence.traffic.checksPassRate}`);
  lines.push(`- Failed request rate: ${evidence.traffic.failedRate}`);
  lines.push('');
  lines.push('## Latency (ms)');
  lines.push('');
  lines.push(`- p50: ${evidence.latencyMs.p50}`);
  lines.push(`- p95: ${evidence.latencyMs.p95}`);
  lines.push(`- p99: ${evidence.latencyMs.p99}`);
  lines.push(`- max: ${evidence.latencyMs.max}`);
  lines.push('');
  lines.push('## Threshold Results');
  lines.push('');
  lines.push('| Metric | Threshold | Observed | Passed | Source |');
  lines.push('|---|---|---|---|---|');
  for (const row of evidence.thresholds) {
    const observed = row.observed === null ? 'n/a' : String(row.observed);
    lines.push(`| ${row.metric} | ${row.threshold} | ${observed} | ${row.passed ? 'yes' : 'no'} | ${row.evaluationSource || 'n/a'} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const [summaryPath, evidenceJsonPath, evidenceMdPath] = process.argv.slice(2);
  if (!summaryPath || !evidenceJsonPath || !evidenceMdPath) usage();

  let evidence;
  let markdown;
  try {
    const summary = loadJson(summaryPath);
    evidence = buildEvidence(summary);
    markdown = renderMarkdown(evidence);
  } catch (error) {
    evidence = buildErrorEvidence(error);
    markdown = renderMarkdown(evidence);
  }

  ensureDir(evidenceJsonPath);
  ensureDir(evidenceMdPath);

  fs.writeFileSync(evidenceJsonPath, JSON.stringify(evidence, null, 2));
  fs.writeFileSync(evidenceMdPath, markdown);

  console.log(`Evidence written: ${evidenceJsonPath}`);
  console.log(`Evidence written: ${evidenceMdPath}`);

  if (evidence.result !== 'PASS') {
    console.error('Performance certification failed: one or more thresholds did not pass.');
    process.exit(1);
  }
}

main();
