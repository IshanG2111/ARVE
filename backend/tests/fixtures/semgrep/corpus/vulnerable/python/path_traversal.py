# Vulnerable: Path Traversal
import os

def read_user_file(filename):
    path = os.path.join("/var/data", filename)
    with open(path, "r") as f:
        return f.read()
