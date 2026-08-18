# Backblaze B2 Artifact Storage

ARVE stores raw scanner artifacts in a private Backblaze B2 bucket. The
worker's filesystem is used only for the temporary Docker workspace and scan
output mount; it is deleted after orchestration completes.

## Required Infisical values

Add these to the existing `dev` → `/backend` environment:

```text
B2_ENDPOINT=https://s3.<your-region>.backblazeb2.com
B2_REGION=<your-region>
B2_BUCKET_NAME=arve-scan-artifacts
B2_ACCESS_KEY_ID=<application-key-id>
B2_SECRET_ACCESS_KEY=<application-key>
B2_ARTIFACT_PREFIX=scans
```

The access key ID and application key are secrets. Do not commit them to
`.env`, `.env.example`, Git, or documentation.

The B2 bucket should be private. Create a bucket-scoped application key with
only the object permissions ARVE needs.

## Artifact layout

```text
scans/
└── <scan-id>/
    └── <engine-name>/
        └── <native scanner output>
```

Examples after Phase 4:

```text
scans/<scan-id>/semgrep/result.sarif
scans/<scan-id>/osv/result.json
scans/<scan-id>/gitleaks/result.json
```

Phase 3's smoke-test engine currently writes JSON:

```text
scans/<scan-id>/phase3-test/phase3-result.json
```

The system does not duplicate an engine result into both JSON and SARIF.
Each scanner keeps its native raw output. Later normalization consumes those
raw artifacts.

## Database reference

`scan_engine_runs.artifact_reference` contains a cloud reference such as:

```text
b2://arve-scan-artifacts/scans/<scan-id>/phase3-test
```

The raw file itself is not stored in PostgreSQL.

## Local filesystem behavior

The scan worker temporarily materializes:

```text
<temporary workspace>/<scan-id>/
├── src/
└── out/
```

Docker mounts `src` read-only and `out` as the writable scanner output
directory. After the engine finishes, the worker uploads the output to B2 and
the scan workspace is removed.

There is **no persistent local artifact directory**.

## Team access

All teammates use the same B2 bucket through the same Infisical-managed
application configuration. The credentials should be provisioned through
Infisical rather than shared in chat or committed to the repository.

The frontend should not receive B2 credentials. Future artifact-download
endpoints should authorize the current ARVE user/project and return a
short-lived presigned URL when direct download is needed.

## Dependency

The backend uses `boto3` for Backblaze's S3-compatible API.

```text
boto3
botocore
```

## Connectivity test

Before running a real scan, verify that the Infisical values can upload,
read, and delete a small test object using boto3. Remove the temporary test
object afterward.

## Phase boundary

Phase 3 only proves that the orchestration layer can upload a native raw
artifact to shared cloud storage. Semgrep, OSV-Scanner, and Gitleaks are
Phase 4 engines.
