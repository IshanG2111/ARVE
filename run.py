import os
import shutil
import subprocess
import sys
import time


def print_banner():
    print("=" * 70)
    print("  ARVE Unified Automated Runner")
    print("  Bootstrapping Docker, Redis, DB Migrations, Celery, Backend & Frontend")
    print("=" * 70)


def run_command(cmd, cwd=None, check=True, capture_output=False, env=None):
    """Helper to run a shell command and handle errors."""
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        capture_output=capture_output,
        text=True,
        env=env or os.environ.copy(),
    )


def is_docker_running():
    """Check if Docker daemon is running and responsive."""
    try:
        res = subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        return res.returncode == 0
    except Exception:
        return False


def ensure_docker_running():
    """Ensure Docker Desktop / daemon is running; attempt to launch if on Windows."""
    if is_docker_running():
        print("✅ [1/5] Docker is up and running.")
        return True

    print("⚠️ [1/5] Docker daemon is not responding.")
    if os.name == "nt":
        docker_desktop_paths = [
            r"C:\Program Files\Docker\Docker\Docker Desktop.exe",
            os.path.expandvars(r"%ProgramFiles%\Docker\Docker\Docker Desktop.exe"),
        ]
        started = False
        for exe_path in docker_desktop_paths:
            if os.path.exists(exe_path):
                print(f"⏳ Launching Docker Desktop from {exe_path}...")
                subprocess.Popen([exe_path], shell=True)
                started = True
                break

        if not started:
            print("⏳ Attempting to launch Docker Desktop via system command...")
            subprocess.Popen('start "" "Docker Desktop"', shell=True)

        print("⏳ Waiting for Docker daemon to become ready (up to 45s)...")
        for _ in range(45):
            time.sleep(2)
            if is_docker_running():
                print("✅ Docker daemon is now running.")
                return True
            print(".", end="", flush=True)
        print()

    if not is_docker_running():
        print("Could not connect to Docker. Please ensure Docker Desktop is started manually.")
        return False
    return True


def ensure_redis(root_dir):
    """Start Redis via docker compose and verify ping."""
    print("\n⏳ [2/5] Starting Redis container via Docker Compose...")
    try:
        run_command(["docker", "compose", "up", "-d", "redis"], cwd=root_dir)
        print("⏳ Checking Redis connection...")
        for _ in range(15):
            res = subprocess.run(
                ["docker", "compose", "exec", "-T", "redis", "redis-cli", "ping"],
                cwd=root_dir,
                capture_output=True,
                text=True,
            )
            if res.returncode == 0 and "PONG" in res.stdout:
                print("Redis is online and responding (PONG).")
                return True
            time.sleep(1)
        print("⚠️ Redis started but ping timed out. Continuing...")
        return True
    except Exception as e:
        print(f"⚠️ Failed to start Redis container: {e}")
        return False


def ensure_scanner_image(root_dir):
    """Ensure the Phase 3 test scanner Docker image is built."""
    print("\n⏳ [3/5] Checking Phase 3 Test Scanner Docker image...")
    try:
        res = subprocess.run(
            ["docker", "images", "-q", "arve-phase3-test-scanner:latest"],
            capture_output=True,
            text=True,
        )
        if res.returncode == 0 and res.stdout.strip():
            print("✅ Scanner image 'arve-phase3-test-scanner:latest' is already built.")
            return True

        print("🔨 Building scanner image 'arve-phase3-test-scanner:latest'...")
        scanner_dockerfile_dir = os.path.join(root_dir, "docker", "phase3-test-scanner")
        run_command(
            ["docker", "build", "-t", "arve-phase3-test-scanner:latest", scanner_dockerfile_dir],
            cwd=root_dir,
        )
        print("✅ Scanner image built successfully.")
        return True
    except Exception as e:
        print(f"⚠️ Scanner image build step failed or skipped: {e}")
        return False


def run_db_migrations(root_dir, backend_dir, infisical_bin):
    """Run Alembic database migrations."""
    print("\n⏳ [4/5] Running database migrations (Alembic)...")
    try:
        if shutil.which("infisical"):
            migration_cmd = [
                infisical_bin, "run", "--env=dev", "--path=/backend", "--",
                "alembic", "upgrade", "head"
            ]
        else:
            migration_cmd = [sys.executable, "-m", "alembic", "upgrade", "head"]

        res = subprocess.run(migration_cmd, cwd=backend_dir)
        if res.returncode == 0:
            print("✅ Database migrations applied successfully.")
        else:
            print("⚠️ Database migration command exited with non-zero status. Proceeding...")
    except Exception as e:
        print(f"⚠️ Migration step encountered an error: {e}. Proceeding...")


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print_banner()

    infisical_present = bool(shutil.which("infisical"))
    infisical_bin = shutil.which("infisical") or "infisical"
    npm_bin = shutil.which("npm") or ("npm.cmd" if os.name == "nt" else "npm")

    if not infisical_present:
        print("⚠️ [WARNING] 'infisical' CLI not found in system PATH.")
        print("            Commands will attempt direct execution (ensure local env vars are configured).\n")

    # Step 1: Docker
    ensure_docker_running()

    # Step 2: Redis
    ensure_redis(root_dir)

    # Step 3: Phase 3 Test Scanner image
    ensure_scanner_image(root_dir)

    # Step 4: DB Migrations
    run_db_migrations(root_dir, backend_dir, infisical_bin)

    # Step 5: Launch Services (Celery Worker, Backend API, Frontend Web UI)
    print("\n🚀 [5/5] Launching ARVE services...")

    # Celery worker configuration
    celery_pool = "solo" if os.name == "nt" else "prefork"
    if infisical_present:
        celery_cmd = [
            infisical_bin, "run", "--env=dev", "--path=/backend", "--",
            sys.executable, "-m", "celery", "-A", "app.celery_app.celery_app",
            "worker", "--loglevel=info", "--pool", celery_pool,
        ]
        backend_cmd = [
            infisical_bin, "run", "--env=dev", "--path=/backend", "--",
            sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"
        ]
        frontend_cmd = [
            infisical_bin, "run", "--env=dev", "--path=/frontend", "--",
            npm_bin, "run", "dev"
        ]
    else:
        celery_cmd = [
            sys.executable, "-m", "celery", "-A", "app.celery_app.celery_app",
            "worker", "--loglevel=info", "--pool", celery_pool,
        ]
        backend_cmd = [
            sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"
        ]
        frontend_cmd = [
            npm_bin, "run", "dev"
        ]

    processes = []
    try:
        # Launch Celery worker
        print(f"  ▶ Launching Celery Worker ({celery_pool} pool)...")
        p_worker = subprocess.Popen(celery_cmd, cwd=backend_dir)
        processes.append(("Celery Worker", p_worker))

        # Launch Backend API
        print("  ▶ Launching FastAPI Backend (Port 8000)...")
        p_backend = subprocess.Popen(backend_cmd, cwd=backend_dir)
        processes.append(("FastAPI Backend", p_backend))

        # Launch Frontend UI
        print("  ▶ Launching Vite Frontend (Port 5173)...")
        p_frontend = subprocess.Popen(frontend_cmd, cwd=frontend_dir)
        processes.append(("Vite Frontend", p_frontend))

        print("\n" + "=" * 70)
        print("  ✨ All ARVE Services are RUNNING!")
        print("     - API Backend : http://localhost:8000")
        print("     - API Docs    : http://localhost:8000/docs")
        print("     - Web UI      : http://localhost:5173")
        print("     - Redis       : redis://localhost:6379/0")
        print("=" * 70)
        print("\nPress Ctrl+C to stop all services cleanly.\n")

        while True:
            time.sleep(1)
            for name, proc in processes:
                if proc.poll() is not None:
                    print(f"⚠️ [RUNNER] {name} exited with status code {proc.returncode}")

    except KeyboardInterrupt:
        print("\n\n🛑 [RUNNER] Shutdown signal received. Stopping ARVE services...")
    finally:
        for name, proc in processes:
            if proc.poll() is None:
                print(f"  Stopping {name}...")
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
        print("✅ All services stopped cleanly. Goodbye!")


if __name__ == "__main__":
    main()
