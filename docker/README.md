# ARVE Phase 3 Docker/Redis setup

Phase 3 uses Docker for scanner isolation and Redis as the Celery broker.
The application database remains the shared Neon PostgreSQL database; this
repository intentionally does not start a local PostgreSQL container for the
normal development workflow.

## 1. Start Redis

```bash
docker compose up -d redis
```

Verify:

```bash
docker compose ps
docker exec arve-redis redis-cli ping
```

Expected:

```text
PONG
```

## 2. Build the Phase 3 smoke-test scanner

This image is **not** a security engine. It only proves that Phase 3 can
reconstruct the Phase 2 snapshot, enter a locked-down container, read `/code`,
and write an artifact to `/output`.

```bash
docker build -t arve-phase3-test-scanner:latest ./docker/phase3-test-scanner
```

## 3. Enable the smoke engine in Infisical

For Phase 3 end-to-end testing only:

```text
SCANNER_ENABLE_TEST_ENGINE=true
SCANNER_TEST_IMAGE=arve-phase3-test-scanner:latest
```

Keep the test engine disabled after Phase 3 testing. Phase 4 will register
Semgrep, OSV-Scanner and Gitleaks.

## 4. Install backend dependencies

```bash
pip install -r backend/requirements.txt
```

The Phase 3 queue requires:

- celery
- redis

## 5. Run migrations

Use the project's normal Infisical command:

```bash
infisical run --env=dev --path=/backend -- alembic upgrade head
```

## 6. Start ARVE

The root `run.py` starts:

- FastAPI
- Celery worker
- Vite frontend

The worker uses the Windows `solo` pool automatically on native Windows and
the default `prefork` pool on Linux/macOS.

```bash
python run.py
```

or use the existing `run.bat` / `run.ps1` launchers.

## Phase 3 sandbox guarantees

Scanner containers are launched with:

```text
--network=none
--read-only
--memory=1g
--cpus=1.5
--user=1000:1000
```

The Phase 2 source snapshot is mounted read-only at `/code` and scanner output
is mounted read/write at `/output`.

## Testing terminal outcomes with the smoke engine

The same image can intentionally exercise Phase 3 failure handling:

```text
SCANNER_TEST_MODE=success  -> COMPLETED
SCANNER_TEST_MODE=fail     -> PARTIAL/FAILED depending on other engines
SCANNER_TEST_MODE=timeout  -> TIMEOUT -> PARTIAL
```

For a real partial-failure test, register/run a successful engine alongside a
second smoke engine configured with `fail` or `timeout`. The Phase 3 service
will persist each `ScanEngineRun` and mark the overall scan `PARTIAL` when at
least one engine produced a result but another engine failed/timed out.
