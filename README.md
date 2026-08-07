# ARVE — Adaptive Remediation & Verification Engine

ARVE links GitHub repositories to target deployment URLs for security verification and automated remediation tracking.

---

## Features

- **GitHub OAuth 2.0 Authentication**: Sign in with GitHub using secure `httpOnly` JWT session cookies.
- **Repository Integration**: Browse and link your GitHub repositories and branches.
- **Project & Target Management**: Connect deployment domains to ARVE projects with automated token-based domain verification.
- **Modern Stack**: Built with FastAPI (Python 3.12) backend and React 19 + Vite + TypeScript frontend.

---

## Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+

### 2. Environment Setup

Copy example environment files:

```bash
# Backend configuration
cp backend/.env.example backend/.env

# Frontend configuration
cp frontend/.env.example frontend/.env
```

To enable live GitHub OAuth login, update `backend/.env` with your GitHub Developer Settings OAuth App credentials:
- **Homepage URL**: `http://localhost:5173`
- **Authorization Callback URL**: `http://localhost:8000/auth/github/callback`

### 3. Run Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

API docs will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 4. Run Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Web app will be available at [http://localhost:5173](http://localhost:5173).

---

## Testing

```bash
# Run backend pytest suite
cd backend
python -m pytest tests

# Run frontend type-check & build
cd frontend
npm run build
```
