import subprocess
import sys
import os
import signal
import time

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("=" * 60)
    print(" [ARVE] Unified Dev Runner")
    print(" Starting FastAPI Backend (Port 8000) & Vite Frontend (Port 5173)...")
    print("=" * 60)


    # Command to start backend
    backend_cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"]
    # Command to start frontend
    frontend_cmd = ["npm.cmd" if os.name == "nt" else "npm", "run", "dev"]

    processes = []
    try:
        # Launch backend
        print("[RUNNER] Launching Backend...")
        p_backend = subprocess.Popen(backend_cmd, cwd=backend_dir)
        processes.append(p_backend)

        # Launch frontend
        print("[RUNNER] Launching Frontend...")
        p_frontend = subprocess.Popen(frontend_cmd, cwd=frontend_dir)
        processes.append(p_frontend)

        print("\n✅ Both servers are starting up:")
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
