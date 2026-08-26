# ARVE — How To Run Project

---

## ⚡ Quick Start (Single Command / One-Click)

To automatically start all services (Docker check, Redis container, Scanner build, Alembic migrations, Celery worker, FastAPI backend, and Vite frontend) in a single step:

### Windows Batch / Double-Click:
```cmd
run.bat
```
*(or run `start.bat`)*

### Python (Cross-Platform):
```bash
python run.py
```

### NPM:
```bash
npm start
```

---

# Manual Step-by-Step Guide


### Option A — Start from Start Menu

Open:

```text
Docker Desktop
```

Wait until Docker Desktop shows:

```text
Docker Engine running
```

### Option B — CMD

If Docker Desktop is installed in the default location:

```cmd
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

Wait until Docker is ready.

---

# 2. Verify Docker

```cmd
docker --version
docker compose version
docker info
```

All commands should complete without a Docker daemon error.

---

# 3. Start Redis

From the ARVE project root:

```cmd
docker compose up -d redis
```

Check:

```cmd
docker compose ps
```

Redis should be running.

Test Redis:

```cmd
docker compose exec redis redis-cli ping
```

Expected:

```text
PONG
```

---

# 4. Build Phase 3 Test Scanner

From the ARVE project root:

```cmd
docker build -t arve-phase3-test-scanner:latest ./docker/phase3-test-scanner
```

Verify:

```cmd
docker images arve-phase3-test-scanner
```

Expected image:

```text
arve-phase3-test-scanner
```

---

# 5. Backend Dependencies

Open **Terminal 1** .

Keep the terminal in:

```text
ARVE\backend
```

Install/update dependencies:

```cmd
pip install -r requirements.txt
```

---

# 6. Database Migration

In same terminal

Run:

```cmd
infisical run --env=dev --path=/backend -- alembic upgrade head
```

Check current migration:

```cmd
infisical run --env=dev --path=/backend -- alembic current
```

---

# 7. Start Celery Worker

In same terminal

run:

```cmd
infisical run --env=dev --path=/backend -- celery -A app.celery_app.celery_app worker --loglevel=info --pool=solo
```

Expected:

```text
Connected to redis://localhost:6379/0
```

and:

```text
celery@<machine> ready.
```

Leave this terminal running.

---

# 8. Start Backend

Open **Terminal 2**.

Keep the terminal in:

```text
ARVE\backend
```

Check if all secrets are available:

```cmd
infisical secrets --env=dev --path=/backend
```


Start FastAPI through Infisical:

```cmd
infisical run --env=dev --path=/backend -- python -m uvicorn app.main:app --reload --port 8000
```

Wait for:

```text
Application startup complete.
```

Leave this terminal running.

---

# 10. Start Frontend

Open **Terminal 3**.

Keep the terminal in:

```text
ARVE\frontend
```

If dependencies are not installed:

```cmd
npm install
```

Check if all secrets are available:

```cmd
infisical secrets --env=dev --path=/frontend
```


Start Vite through Infisical:

```cmd
infisical run --env=dev --path=/frontend -- npm run dev
```

Leave this terminal running.

---