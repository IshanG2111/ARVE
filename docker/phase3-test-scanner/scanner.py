#!/usr/bin/env python3
import hashlib
import json
import os
import sys
import time
from pathlib import Path

mode = os.getenv("ARVE_TEST_MODE", "success").lower()
if mode == "timeout":
    time.sleep(3600)
elif mode == "fail":
    print("intentional Phase 3 test-engine failure", file=sys.stderr)
    raise SystemExit(17)

root = Path("/code")
out = Path("/output")
out.mkdir(parents=True, exist_ok=True)

files = []
total_bytes = 0
for path in sorted(p for p in root.rglob("*") if p.is_file()):
    data = path.read_bytes()
    files.append({
        "path": path.relative_to(root).as_posix(),
        "size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    })
    total_bytes += len(data)

result = {
    "engine": "phase3-test",
    "ok": True,
    "file_count": len(files),
    "total_bytes": total_bytes,
    "files": files,
    "network_disabled_by_runner": True,
    "pid": os.getpid(),
}
(out / "phase3-result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps({"engine": "phase3-test", "files": len(files), "bytes": total_bytes}))
