import subprocess
import sys
import os
import signal
import time
import shutil

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
    print(" Starting FastAPI Backend (Port 8000) & Vite Frontend (Port 5173)...")
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

        # Launch frontend
        print("[RUNNER] Launching Frontend with Infisical (--path=/frontend)...")
        p_frontend = subprocess.Popen(frontend_cmd, cwd=frontend_dir)
        processes.append(p_frontend)

        print("\n✅ Both services are starting up via Infisical:")
        print("   - API Backend : http://localhost:8000")
        print("   - API Docs    : http://localhost:8000/docs")
        print("   - Web UI      : http://localhost:5173")
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

