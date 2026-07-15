#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

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
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getMetricValue(metrics, metricName, valueName, fallback = null) {
  return metrics?.[metricName]?.values?.[valueName] ?? fallback;
}

function collectThresholds(metrics) {
  const rows = [];
  for (const [metricName, metric] of Object.entries(metrics || {})) {
    const thresholds = metric?.thresholds || {};
    for (const [thresholdExpr, passed] of Object.entries(thresholds)) {
      rows.push({ metric: metricName, threshold: thresholdExpr, passed: Boolean(passed) });
    }
  }
  return rows;
}

function toFixedMaybe(value, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function buildEvidence(summary) {
  const metrics = summary.metrics || {};
  const thresholds = collectThresholds(metrics);

  if (thresholds.length === 0) {
    throw new Error('No threshold evaluations found in k6 summary. Ensure k6 thresholds are defined.');
  }

  const failedThresholds = thresholds.filter((t) => !t.passed);
  const passed = failedThresholds.length === 0;

  return {
    generatedAtUtc: new Date().toISOString(),
    result: passed ? 'PASS' : 'FAIL',
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

function renderMarkdown(evidence) {
  const lines = [];
  lines.push('# Performance Certification Evidence');
  lines.push('');
  lines.push(`- Result: **${evidence.result}**`);
  lines.push(`- Generated (UTC): ${evidence.generatedAtUtc}`);
  lines.push(`- Thresholds: ${evidence.totals.thresholds}`);
  lines.push(`- Failed thresholds: ${evidence.totals.failedThresholds}`);
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
  lines.push('| Metric | Threshold | Passed |');
  lines.push('|---|---|---|');
  for (const row of evidence.thresholds) {
    lines.push(`| ${row.metric} | ${row.threshold} | ${row.passed ? 'yes' : 'no'} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const [summaryPath, evidenceJsonPath, evidenceMdPath] = process.argv.slice(2);
  if (!summaryPath || !evidenceJsonPath || !evidenceMdPath) usage();

  const summary = loadJson(summaryPath);
  const evidence = buildEvidence(summary);
  const markdown = renderMarkdown(evidence);

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
