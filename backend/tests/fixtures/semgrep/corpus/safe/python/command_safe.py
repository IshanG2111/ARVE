# Safe: Argument vector command execution without shell
import subprocess

def ping_host_safe(ip: str):
    subprocess.run(["ping", "-c", "1", ip], check=True)
