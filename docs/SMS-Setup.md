# Infisical Shared Secret Management Setup Guide

## ARVE Team Development Setup

This guide explains how to configure **Infisical** for a team project
with:

-   React/Vite frontend
-   Python/FastAPI backend
-   Separate frontend and backend environment variables
-   Windows development using Command Prompt (CMD)
-   macOS development using Terminal/zsh
-   Shared development secrets stored outside Git
-   Separate Infisical folders for frontend and backend

The workflow in this guide is based on the Infisical CLI workflow:

1.  Install the CLI
2.  Log in
3.  Initialize the local project
4.  Store secrets in Infisical
5.  Retrieve/test secrets
6.  Run applications with secrets injected at runtime

> **Important:** Do not commit real `.env` files, Firebase private keys,
> GitHub client secrets, database passwords, or other sensitive
> credentials to Git.

------------------------------------------------------------------------

# 1. Recommended Infisical Project Structure

For ARVE, use one Infisical project with a `Development` environment.

Recommended structure:

``` text
ARVE
└── Development
    ├── frontend
    │   ├── VITE_FIREBASE_API_KEY
    │   ├── VITE_FIREBASE_AUTH_DOMAIN
    │   ├── VITE_FIREBASE_PROJECT_ID
    │   ├── VITE_FIREBASE_STORAGE_BUCKET
    │   ├── VITE_FIREBASE_MESSAGING_SENDER_ID
    │   ├── VITE_FIREBASE_APP_ID
    │   └── other frontend variables
    │
    └── backend
        ├── GITHUB_CLIENT_ID
        ├── GITHUB_CLIENT_SECRET
        ├── FIREBASE_PRIVATE_KEY
        ├── FIREBASE_CLIENT_EMAIL
        ├── DATABASE_URL
        └── other backend variables
```

The exact variable names should match the names expected by the
application.

The `--path` option lets the CLI select a specific Infisical folder when
retrieving secrets.

------------------------------------------------------------------------

# 2. Local Project Structure

The local repository can remain organized like this:

``` text
ARVE/
│
├── backend/
│   ├── app/
│   │   └── main.py
│   ├── .env
│   └── ...
│
├── frontend/
│   ├── .env
│   └── ...
│
├── run.py
├── .gitignore
└── .infisical.json
```

The `.env` files may be retained temporarily during migration/testing,
but they must not be committed to Git.

After Infisical has been verified, the team can remove the real secret
values from local `.env` files and use Infisical for development.

------------------------------------------------------------------------

# 3. Before Starting

Each developer needs:

-   An Infisical account
-   Access to the ARVE Infisical project
-   Node.js/npm installed
-   Git installed
-   The ARVE repository cloned locally
-   Python and the project's virtual environment configured for the
    backend

For the current development workflow, each developer should use their
own Infisical account rather than sharing one Infisical password.

------------------------------------------------------------------------

# 4. Install Infisical CLI --- Windows

## npm

If Node.js/npm is already installed, install the CLI globally:

``` cmd
npm install -g @infisical/cli
```

Verify:

``` cmd
infisical --version
```

You should see the installed CLI version.

### Important

The global npm installation does NOT mean Infisical becomes a dependency
of the React application.

It is a command-line tool installed on the developer's computer.
is no need to install both.

------------------------------------------------------------------------

# 5. Install Infisical CLI --- macOS

The recommended Homebrew installation is:

``` bash
brew install infisical/get-cli/infisical
```

Verify:

``` bash
infisical --version
```

To update later:

``` bash
brew update
brew upgrade infisical
```

------------------------------------------------------------------------

# 6. Log In

The login command is the same on Windows and macOS:

``` bash
infisical login
```

The default login flow opens a browser for authentication.

Each developer should log in using their own Infisical account.

Do not share:

-   Infisical passwords
-   Personal access tokens
-   Service-account tokens
-   Machine identity credentials

After login, verify the session:

``` bash
infisical login status
```

A successful status should indicate that an authenticated session
exists.

------------------------------------------------------------------------

# 7. Verify the Project Configuration

From the ARVE root:

``` text
ARVE/
├── .infisical.json
├── backend/
├── frontend/
└── run.py
```

Check that `../.infisical.json` exists.

Do not manually put secret values into `../.infisical.json`.

------------------------------------------------------------------------

# 8. Verify the Backend Secrets

Go into the backend directory.

run:

``` bash
infisical secrets --env=dev --path=/backend
```

This checks the secrets available under the backend path.

Do not copy/paste secret values into chat, GitHub issues, Discord, or
other public/shared locations.

------------------------------------------------------------------------

# 9. Run the FastAPI Backend with Infisical

For the ARVE backend, the FastAPI application is:

``` text
app.main:app
```

The backend should therefore be started with:

``` bash
infisical run --env=dev --path=/backend -- uvicorn app.main:app --reload --port 8000
```

This command:

1.  Connects to the `dev` environment.
2.  Reads secrets from `/backend`.
3.  Injects them into the process environment.
4.  Starts Uvicorn.
5.  Runs FastAPI on port 8000.

Expected URL:

``` text
http://localhost:8000
```

FastAPI documentation:

``` text
http://localhost:8000/docs
```

------------------------------------------------------------------------

# 10. Verify the Frontend Secrets

Open another terminal.

Go to the frontend directory.

run:
``` cmd
infisical secrets --env=dev --path=/frontend
```
This verifies that the frontend folder is accessible.

------------------------------------------------------------------------

# 11. Run React/Vite with Infisical

run:

``` bash
infisical run --env=dev --path=/frontend -- npm run dev
```

This works on both Windows CMD and macOS when npm is available.

Expected Vite URL is usually:

``` text
http://localhost:5173
```

------------------------------------------------------------------------

# 12. ARVE Quick Start - windows

``` cmd
git clone <REPOSITORY_URL>
cd ARVE

npm install -g @infisical/cli

infisical --version
infisical login
infisical login status
```

Backend:

``` cmd
cd backend

infisical secrets --env=dev --path=/backend

infisical run --env=dev --path=/backend -- uvicorn app.main:app --reload --port 8000
```

Frontend, in another CMD:

``` cmd
cd frontend

infisical secrets --env=dev --path=/frontend

infisical run --env=dev --path=/frontend -- npm run dev
```

------------------------------------------------------------------------

# 13. ARVE Quick Start --- macOS

``` bash
git clone <REPOSITORY_URL>
cd ARVE

brew install infisical/get-cli/infisical

infisical --version
infisical login
infisical login status
```

Backend:

``` bash
cd backend

infisical secrets --env=dev --path=/backend

infisical run --env=dev --path=/backend -- uvicorn app.main:app --reload --port 8000
```

Frontend, in another Terminal:

``` bash
cd frontend

infisical secrets --env=dev --path=/frontend

infisical run --env=dev --path=/frontend -- npm run dev
```

------------------------------------------------------------------------

# 14. Database Upgrade with Alembic

Before running the backend, apply any pending database migrations:

``` cmd
cd backend
infisical run --env=dev --path=/backend -- alembic upgrade head
```
------------------------------------------------------------------------