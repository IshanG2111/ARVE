import os
import shutil
import subprocess
import sys
import time


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    infisical_bin = shutil.which("infisical") or "infisical"
    npm_bin = shutil.which("npm") or ("npm.cmd" if os.name == "nt" else "npm")

    print("=" * 60)
    print(" [ARVE] Unified Dev Runner (Infisical Integrated)")
    print(" Starting FastAPI Backend (Port 8000), Celery Worker, and Vite Frontend (Port 5173)...")
    print("=" * 60)

    if not shutil.which("infisical"):
        print("[WARNING] 'infisical' CLI not found in system PATH.")
        print("          Ensure Infisical CLI is installed and 'infisical login' has been run.\n")

    # Command to start backend via Infisical
    backend_cmd = [
        infisical_bin, "run", "--env=dev", "--path=/backend", "--",
        sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"
    ]

    # Command to start frontend via Infisical
    frontend_cmd = [
        infisical_bin, "run", "--env=dev", "--path=/frontend", "--",
        npm_bin, "run", "dev"
    ]

    processes = []
    try:
        # Launch backend
        print("[RUNNER] Launching Backend with Infisical (--path=/backend)...")
        p_backend = subprocess.Popen(backend_cmd, cwd=backend_dir)
        processes.append(p_backend)

        # Launch Celery worker. Windows uses the solo pool because Celery's
        # prefork model is not reliable on native Windows. Linux/macOS use
        # the default worker pool.
        celery_pool = "solo" if os.name == "nt" else "prefork"
        celery_cmd = [
            infisical_bin, "run", "--env=dev", "--path=/backend", "--",
            sys.executable, "-m", "celery", "-A", "app.celery_app:celery_app",
            "worker", "--loglevel=INFO", "--pool", celery_pool,
        ]
        print(f"[RUNNER] Launching Celery worker ({celery_pool}) with Infisical...")
        p_worker = subprocess.Popen(celery_cmd, cwd=backend_dir)
        processes.append(p_worker)

        # Launch frontend
        print("[RUNNER] Launching Frontend with Infisical (--path=/frontend)...")
        p_frontend = subprocess.Popen(frontend_cmd, cwd=frontend_dir)
        processes.append(p_frontend)

        print("\n✅ Backend, Celery worker, and frontend are starting via Infisical:")
        print("   - API Backend : http://localhost:8000")
        print("   - API Docs    : http://localhost:8000/docs")
        print("   - Web UI      : http://localhost:5173")
        print("   - Redis       : redis://localhost:6379/0")
        print("\nPress Ctrl+C to stop both servers.\n")

        while True:
            time.sleep(1)
            # Check if any process terminated prematurely
            for p in processes:
                if p.poll() is not None:
                    print(f"[RUNNER] Process {p.args} exited with code {p.returncode}")
                    break

    except KeyboardInterrupt:
        print("\n[RUNNER] Shutting down ARVE services...")
    finally:
        for p in processes:
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    p.kill()
        print("[RUNNER] All processes stopped cleanly. Goodbye!")

if __name__ == "__main__":
    main()

