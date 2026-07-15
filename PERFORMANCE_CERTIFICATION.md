# Performance Certification Pipeline

This repository includes a repeatable performance-certification pipeline based on k6.

## What it produces

- `perf-artifacts/summary.json`: raw k6 summary export
- `perf-artifacts/evidence.json`: machine-readable certification evidence
- `perf-artifacts/evidence.md`: human-readable evidence report

## Local run

Prerequisites:

- k6 installed and available in PATH
- target environment URL

Example:

```bash
PERF_BASE_URL=https://your-app.example.com npm run -s perf:gate
```

Optional environment variables:

- `EDGE_HEALTH_URLS`: comma-separated URLs for edge health checks
- `PERF_P95_MS` (default `800`)
- `PERF_P99_MS` (default `2000`)
- `PERF_MAX_FAILED_RATE` (default `0.01`)
- `PERF_MIN_CHECK_RATE` (default `0.99`)
- `PERF_STAGE1_VUS` (default `50`)
- `PERF_STAGE2_VUS` (default `200`)
- `PERF_STAGE3_VUS` (default `400`)

## CI run

Workflow:

- `.github/workflows/performance-certification.yml`

Required GitHub secret:

- `PERF_BASE_URL`

Optional GitHub secret:

- `EDGE_HEALTH_URLS`

Optional GitHub variables:

- `PERF_P95_MS`
- `PERF_P99_MS`
- `PERF_MAX_FAILED_RATE`
- `PERF_MIN_CHECK_RATE`
- `PERF_STAGE1_VUS`
- `PERF_STAGE2_VUS`
- `PERF_STAGE3_VUS`

## Pass criteria

Certification is PASS only when all configured thresholds pass. The evidence script exits non-zero on failure.
