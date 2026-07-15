# Performance Certification Pipeline

This repository includes a repeatable performance-certification pipeline based on k6.

## What it produces

- `perf-artifacts/summary.json`: raw k6 summary export
- `perf-artifacts/evidence.json`: machine-readable certification evidence
- `perf-artifacts/evidence.md`: human-readable evidence report
- `perf-artifacts/run-context.json`: run metadata (commit/ref/profile), no secrets

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
- `PERF_ALLOW_INSECURE_LOCAL`: set `1` only for localhost HTTP testing
- `PERF_P95_MS` (default `800`)
- `PERF_P99_MS` (default `2000`)
- `PERF_MAX_FAILED_RATE` (default `0.01`)
- `PERF_MIN_CHECK_RATE` (default `0.99`)
- `PERF_STAGE1_VUS` (default `50`)
- `PERF_STAGE2_VUS` (default `200`)
- `PERF_STAGE3_VUS` (default `400`)
- `PERF_STAGE1_DURATION` (default `2m`)
- `PERF_STAGE2_DURATION` (default `3m`)
- `PERF_STAGE3_DURATION` (default `3m`)
- `PERF_STAGE4_DURATION` (default `2m`)

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
- `PERF_STAGE1_DURATION`
- `PERF_STAGE2_DURATION`
- `PERF_STAGE3_DURATION`
- `PERF_STAGE4_DURATION`

## Pass criteria

Certification is PASS only when all configured thresholds pass. The evidence script exits non-zero on failure.

## Safety controls

- `PERF_BASE_URL` and each URL in `EDGE_HEALTH_URLS` must be `https://`.
- Local insecure testing is blocked by default; use `PERF_ALLOW_INSECURE_LOCAL=1` only for localhost.
- VU stage values are range-validated to prevent accidental extreme runs.
- Workflow uses branch-scoped concurrency and least-privilege `contents: read` permissions.
- Workflow preflight fails fast if required config is missing or insecure.
- Evidence includes summary SHA-256 and GitHub run metadata for audit traceability.
