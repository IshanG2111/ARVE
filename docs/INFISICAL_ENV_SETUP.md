# Infisical Environment Keys Guide

> **Quick Reference:** Essential environment variables that must be added to **Infisical** for ARVE deployments and team synchronization.

---

## 1. Backend Scope (`/backend`)

Configure these keys in Infisical under the `/backend` folder path:

### A. Critical Secrets & Credentials (Required)

| Key | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL / Neon DB connection string | `postgresql://user:pass@ep-xyz.aws.neon.tech/arve-db?sslmode=require` |
| `REDIS_URL` | Redis instance for Celery scan queue | `redis://localhost:6379/0` |
| `JWT_SECRET` | Secret key for signing user session tokens | *(Generate a 32+ char random string)* |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | *(From GitHub Developer Settings)* |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Secret Token | *(From GitHub Developer Settings)* |
| `GITHUB_REDIRECT_URI` | Backend OAuth callback endpoint | `http://localhost:8000/auth/github/callback` |

### B. Core Operational Defaults (Required)

| Key | Description | Value |
| :--- | :--- | :--- |
| `ARVE_ENV` | Environment identifier | `dev` (or `production`) |
| `FRONTEND_URL` | Web UI origin for CORS & redirects | `http://localhost:5173` |
| `SCAN_QUEUE_BACKEND` | Task queue driver | `celery` |
| `JWT_ALGORITHM` | JWT token hashing algorithm | `HS256` |
| `JWT_EXPIRE_MINUTES` | Token session validity | `10080` (7 days) |
| `GITHUB_OAUTH_SCOPE` | GitHub permissions requested | `read:user user:email repo` |
| `FIREBASE_PROJECT_ID` | Firebase project identifier | `arve-fe63b` |

### C. Security Scanner Engines (Phase 4A)

| Key | Description | Value |
| :--- | :--- | :--- |
| `SCANNER_ENABLE_SEMGREP` | Enable Semgrep SAST engine | `true` |
| `SCANNER_SEMGREP_IMAGE` | Pinned Semgrep container image | `semgrep/semgrep:1.90.0` |
| `SCANNER_SEMGREP_CONFIG` | Rules config mode | `auto` |
| `SCANNER_SEMGREP_NETWORK`| Sandbox network isolation | `none` |
| `SCANNER_ENABLE_OSV` | Enable OSV-Scanner (SCA) | `true` |
| `SCANNER_OSV_IMAGE` | Pinned OSV container image | `ghcr.io/google/osv-scanner:v1.9.2` |
| `SCANNER_OSV_NETWORK` | OSV network mode (needs live DB) | `bridge` |
| `SCANNER_ENABLE_GITLEAKS`| Enable Gitleaks secret scanner | `true` |
| `SCANNER_GITLEAKS_IMAGE` | Pinned Gitleaks container image | `ghcr.io/gitleaks/gitleaks:v8.24.2` |
| `SCANNER_NETWORK_MODE` | Default container network mode | `none` |

### D. Cloud Artifact Storage (Backblaze B2) *(Production / Staging)*

| Key | Description | Example Value |
| :--- | :--- | :--- |
| `B2_ENDPOINT` | S3-compatible Backblaze endpoint | `https://s3.<region>.backblazeb2.com` |
| `B2_REGION` | Backblaze bucket region | `us-west-004` |
| `B2_BUCKET_NAME` | Storage bucket name | `arve-scan-artifacts` |
| `B2_ACCESS_KEY_ID` | Application key ID | *(Your B2 Key ID)* |
| `B2_SECRET_ACCESS_KEY` | Application key secret | *(Your B2 App Key)* |

---

## 2. Frontend Scope (`/frontend`)

Configure these keys in Infisical under the `/frontend` folder path:

| Key | Description | Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | Backend API root address | `http://localhost:8000` |
| `VITE_FIREBASE_API_KEY` | Firebase Web API key | `AIzaSyAw1lZFEUNLVDs2JwxfBVJMbvjqBoNSlNE` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase authentication domain | `arve-fe63b.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project identifier | `arve-fe63b` |
| `VITE_FIREBASE_STORAGE_BUCKET`| Firebase storage bucket | `arve-fe63b.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Cloud messaging sender ID | `1062714082926` |
| `VITE_FIREBASE_APP_ID` | Web application ID | `1:1062714082926:web:demo` |

---

## 3. Quick Copy-Paste Blocks

### Backend Raw Block (`/backend`)
```ini
ARVE_ENV=dev
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://user:pass@ep-xyz.aws.neon.tech/arve-db?sslmode=require
REDIS_URL=redis://localhost:6379/0
SCAN_QUEUE_BACKEND=celery
JWT_SECRET=arve-secret-key-super-secure-change-in-production-2026
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:8000/auth/github/callback
GITHUB_OAUTH_SCOPE=read:user user:email repo
FIREBASE_PROJECT_ID=arve-fe63b
SCANNER_ENABLE_SEMGREP=true
SCANNER_SEMGREP_IMAGE=semgrep/semgrep:1.90.0
SCANNER_SEMGREP_CONFIG=auto
SCANNER_SEMGREP_NETWORK=none
SCANNER_ENABLE_OSV=true
SCANNER_OSV_IMAGE=ghcr.io/google/osv-scanner:v1.9.2
SCANNER_OSV_NETWORK=bridge
SCANNER_ENABLE_GITLEAKS=true
SCANNER_GITLEAKS_IMAGE=ghcr.io/gitleaks/gitleaks:v8.24.2
SCANNER_NETWORK_MODE=none
```

### Frontend Raw Block (`/frontend`)
```ini
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=AIzaSyAw1lZFEUNLVDs2JwxfBVJMbvjqBoNSlNE
VITE_FIREBASE_AUTH_DOMAIN=arve-fe63b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=arve-fe63b
VITE_FIREBASE_STORAGE_BUCKET=arve-fe63b.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1062714082926
VITE_FIREBASE_APP_ID=1:1062714082926:web:demo
```

---

## 4. How to Verify via CLI

```bash
# Check backend secrets
infisical secrets --env=dev --path=/backend

# Check frontend secrets
infisical secrets --env=dev --path=/frontend
```
