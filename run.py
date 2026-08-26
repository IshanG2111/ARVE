"""
ARVE — One-File Runner

Run from the ARVE project root:

    python run.py

This runner intentionally does NOT:
- start Docker Desktop
- check whether Infisical is installed before running
- check repository file paths before running
- create a virtual environment
- create fallback environments
- silently skip commands

It executes the commands from HOW_TO_RUN.md in order.
Docker Desktop must already be running.
The existing project virtual environment must already be available/active.
"""

from __future__ import annotations

import os
import platform
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

BACKEND_PORT = 8000
FRONTEND_PORT = 5173

processes: list[tuple[str, subprocess.Popen]] = []


def banner(title: str) -> None:
    print("\n" + "=" * 78)
    print(f"  {title}")
    print("=" * 78)


def run_command(
    command: list[str],
    cwd: Path | None = None,
    *,
    check: bool = True,
) -> subprocess.CompletedProcess:
    print("\n$ " + " ".join(command))
    # On Windows, execute through cmd.exe so commands such as `infisical`,
    # `alembic`, `celery`, `python`, and `npm` are resolved exactly as they
    # are when typed manually in the terminal. The working directory is still
    # explicitly controlled by `cwd`.
    if platform.system() == "Windows":
        command_line = subprocess.list2cmdline(command)
        return subprocess.run(
            command_line,
            cwd=str(cwd) if cwd else None,
            text=True,
            check=check,
            shell=True,
        )

    return subprocess.run(
        command,
        cwd=str(cwd) if cwd else None,
        text=True,
        check=check,
    )


def docker_is_running() -> bool:
    result = subprocess.run(
        ["docker", "info"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def check_docker() -> None:
    # Runs from ARVE root (same directory where python run.py is launched).
    banner("1 — Docker Check")

    if not docker_is_running():
        print("\n[ERROR] Docker Desktop / Docker Engine is not running.")
        print("[ERROR] Start Docker Desktop manually, wait until Docker Engine is running,")
        print("[ERROR] then run this file again.")
        raise SystemExit(1)

    # Exact commands from HOW_TO_RUN.md.
    run_command(["docker", "--version"])
    run_command(["docker", "compose", "version"])
    run_command(["docker", "info"])

    print("\n[OK] Docker checks completed.")


def start_redis() -> None:
    # Runs from ARVE root.
    banner("2 — Redis")

    # Exact commands from HOW_TO_RUN.md.
    run_command(["docker", "compose", "up", "-d", "redis"], cwd=ROOT)
    run_command(["docker", "compose", "ps"], cwd=ROOT)
    run_command(
        ["docker", "compose", "exec", "redis", "redis-cli", "ping"],
        cwd=ROOT,
    )

    print("\n[OK] Redis startup and PONG check completed.")


def build_scanner() -> None:
    # Runs from ARVE root because the Docker build context is ./docker/phase3-test-scanner.
    banner("3 — Phase 3 Test Scanner")

    # Exact commands from HOW_TO_RUN.md.
    run_command(
        [
            "docker",
            "build",
            "-t",
            "arve-phase3-test-scanner:latest",
            "./docker/phase3-test-scanner",
        ],
        cwd=ROOT,
    )

    run_command(
        ["docker", "images", "arve-phase3-test-scanner"],
        cwd=ROOT,
    )

    print("\n[OK] Phase 3 scanner build completed.")


def backend_dependencies() -> None:
    # Runs from ARVE/backend.
    banner("4 — Backend Dependencies")

    # Exact command from HOW_TO_RUN.md.
    run_command(
        ["pip", "install", "-r", "requirements.txt"],
        cwd=BACKEND,
    )

    print("\n[OK] Backend dependencies completed.")


def database_migration() -> None:
    # Runs from ARVE/backend.
    banner("5 — Database Migration")

    # Exact commands from HOW_TO_RUN.md.
    run_command(
        [
            "infisical",
            "run",
            "--env=dev",
            "--path=/backend",
            "--",
            "alembic",
            "upgrade",
            "head",
        ],
        cwd=BACKEND,
    )

    run_command(
        [
            "infisical",
            "run",
            "--env=dev",
            "--path=/backend",
            "--",
            "alembic",
            "current",
        ],
        cwd=BACKEND,
    )

    print("\n[OK] Database migration completed.")


def start_celery() -> None:
    # Runs from ARVE/backend.
    banner("6 — Celery Worker")

    # HOW_TO_RUN.md uses --pool=solo for the documented Windows command.
    # solo is also valid on macOS and avoids platform-specific worker behavior.
    command = [
        "infisical",
        "run",
        "--env=dev",
        "--path=/backend",
        "--",
        "celery",
        "-A",
        "app.celery_app.celery_app",
        "worker",
        "--loglevel=info",
        "--pool=solo",
    ]

    print("\n$ " + " ".join(command))
    if platform.system() == "Windows":
        # Start Celery as a long-running child process without blocking this
        # runner. cmd.exe resolves Infisical exactly like a normal terminal.
        command_line = subprocess.list2cmdline(command)
        process = subprocess.Popen(
            ["cmd.exe", "/d", "/s", "/c", command_line],
            cwd=str(BACKEND),
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
    else:
        process = subprocess.Popen(
            command,
            cwd=str(BACKEND),
            start_new_session=True,
        )
    processes.append(("Celery Worker", process))

    time.sleep(2)

    if process.poll() is not None:
        raise RuntimeError(
            f"Celery worker exited immediately with code {process.returncode}."
        )

    print("[OK] Celery worker started.")


def start_backend() -> None:
    # Runs from ARVE/backend.
    banner("7 — FastAPI Backend")

    # HOW_TO_RUN.md command.
    command = [
        "infisical",
        "run",
        "--env=dev",
        "--path=/backend",
        "--",
        "python",
        "-m",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--port",
        "8000",
    ]

    print("\n$ " + " ".join(command))
    if platform.system() == "Windows":
        command_line = subprocess.list2cmdline(command)
        process = subprocess.Popen(
            ["cmd.exe", "/d", "/s", "/c", command_line],
            cwd=str(BACKEND),
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
    else:
        process = subprocess.Popen(
            command,
            cwd=str(BACKEND),
            start_new_session=True,
        )
    processes.append(("FastAPI Backend", process))

    print("[OK] FastAPI startup command launched.")


def frontend_dependencies() -> None:
    # Runs from ARVE/frontend.
    banner("8 — Frontend Dependencies")

    # Exact command from HOW_TO_RUN.md.
    run_command(["npm", "install"], cwd=FRONTEND)

    print("\n[OK] Frontend dependencies completed.")


def verify_backend_secrets() -> None:
    # Runs from ARVE/backend.
    banner("9 — Backend Infisical Secrets")

    # Exact command from HOW_TO_RUN.md.
    run_command(
        [
            "infisical",
            "secrets",
            "--env=dev",
            "--path=/backend",
        ],
        cwd=BACKEND,
    )

    print("\n[OK] Backend Infisical secrets command completed.")


def verify_frontend_secrets() -> None:
    # Runs from ARVE/frontend.
    banner("10 — Frontend Infisical Secrets")

    # Exact command from HOW_TO_RUN.md.
    run_command(
        [
            "infisical",
            "secrets",
            "--env=dev",
            "--path=/frontend",
        ],
        cwd=FRONTEND,
    )

    print("\n[OK] Frontend Infisical secrets command completed.")


def start_frontend() -> None:
    # Runs from ARVE/frontend.
    banner("11 — Vite Frontend")

    # Exact command from HOW_TO_RUN.md.
    command = [
        "infisical",
        "run",
        "--env=dev",
        "--path=/frontend",
        "--",
        "npm",
        "run",
        "dev",
    ]

    print("\n$ " + " ".join(command))
    if platform.system() == "Windows":
        command_line = subprocess.list2cmdline(command)
        process = subprocess.Popen(
            ["cmd.exe", "/d", "/s", "/c", command_line],
            cwd=str(FRONTEND),
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
    else:
        process = subprocess.Popen(
            command,
            cwd=str(FRONTEND),
            start_new_session=True,
        )
    processes.append(("Vite Frontend", process))

    print("[OK] Vite startup command launched.")


def port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def http_ready(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=3) as response:
            return response.status < 500
    except Exception:
        return False


def health_checks() -> None:
    banner("12 — Final Health Checks")

    print("[..] Waiting for FastAPI on port 8000...")
    backend_ready = False

    for _ in range(45):
        if port_open("127.0.0.1", BACKEND_PORT):
            backend_ready = True
            break
        time.sleep(1)

    if backend_ready:
        print("[OK] FastAPI is listening on http://localhost:8000")
        if http_ready("http://localhost:8000/docs"):
            print("[OK] FastAPI docs responding: http://localhost:8000/docs")
    else:
        print("[WARN] FastAPI did not open port 8000 within the wait period.")

    print("[..] Waiting for Vite on port 5173...")
    frontend_ready = False

    for _ in range(45):
        if port_open("127.0.0.1", FRONTEND_PORT):
            frontend_ready = True
            break
        time.sleep(1)

    if frontend_ready:
        print("[OK] Vite is listening on http://localhost:5173")
    else:
        print("[WARN] Vite did not open port 5173 within the wait period.")

    for name, process in processes:
        if process.poll() is None:
            print(f"[OK] {name}: RUNNING")
        else:
            print(f"[ERROR] {name}: EXITED ({process.returncode})")


def stop_process(name: str, process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return

    print(f"[..] Stopping {name}...")

    if platform.system() == "Windows":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(process.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    else:
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            process.terminate()

    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()

    print(f"[OK] {name} stopped.")


def shutdown() -> None:
    if not processes:
        return

    banner("Shutdown")

    for name, process in reversed(processes):
        stop_process(name, process)

    print("[OK] Application services stopped.")
    print("[INFO] Redis remains running under Docker Compose.")


def signal_handler(signum, frame) -> None:
    shutdown()
    raise SystemExit(0)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, signal_handler)

    banner("ARVE — ONE-FILE RUNNER")
    print("Platform:", platform.system())
    print("Following HOW_TO_RUN.md command order.")
    print("python run.py is expected to be launched from the ARVE root.")
    print("Docker commands run from: ARVE root")
    print("Backend commands run from: ARVE/backend")
    print("Frontend commands run from: ARVE/frontend")
    print("Docker must already be running.")
    print("No virtual environment is created by this runner.")

    # run.py is intentionally a root-level runner. All commands below use
    # explicit working directories matching HOW_TO_RUN.md.
    if Path.cwd().resolve() != ROOT.resolve():
        print("\n[ERROR] Please run python run.py from the ARVE project root.")
        print(f"[ERROR] Expected working directory: {ROOT}")
        print(f"[ERROR] Current working directory:  {Path.cwd().resolve()}")
        return 1

    try:
        # Keep the command sequence aligned with HOW_TO_RUN.md.
        check_docker()
        start_redis()
        build_scanner()
        backend_dependencies()
        database_migration()
        start_celery()
        start_backend()
        frontend_dependencies()
        verify_backend_secrets()
        verify_frontend_secrets()
        start_frontend()
        health_checks()

        banner("ARVE IS RUNNING")
        print("Web UI    : http://localhost:5173")
        print("API       : http://localhost:8000")
        print("API Docs  : http://localhost:8000/docs")
        print("Redis     : redis://localhost:6379/0")
        print("\nPress Ctrl+C to stop Celery, FastAPI and Vite.")

        while True:
            time.sleep(2)

    except KeyboardInterrupt:
        return 0
    except SystemExit:
        raise
    except Exception as exc:
        print(f"\n[ERROR] Runner stopped: {exc}")
        return 1
    finally:
        shutdown()


if __name__ == "__main__":
    raise SystemExit(main())
