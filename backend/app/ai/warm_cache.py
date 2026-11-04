"""Pre-fill the AI cache for one scan so a demo does not depend on live model capacity.

Usage, from ``backend/``:
    infisical run --env=dev --path=/backend -- python -m app.ai.warm_cache <scan id or prefix> [--limit 10]

Explains the scan's most severe open findings (by default the same ten the AI summary covers), then the summary.
Already-cached answers are not re-requested. Only validated answers are stored, as with the buttons.
"""
from __future__ import annotations

import argparse
import sys
import time

from app.ai.context import select_top_findings
from app.ai.service import _gate, explain_finding, summarize_scan
from app.core.database import SessionLocal
from app.models.models import Scan

# Each answer can take two requests (a retry or a repair); this keeps the free tier under ~6 requests/minute.
PAUSE_SECONDS = 20


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("scan", help="scan id, or a unique prefix of it")
    parser.add_argument("--limit", type=int, default=10, help="number of findings to explain (default 10)")
    args = parser.parse_args(argv)

    db = SessionLocal()
    try:
        scans = db.query(Scan).filter(Scan.id.like(args.scan + "%")).limit(2).all()
        if len(scans) != 1:
            print(f"Expected exactly one scan matching {args.scan!r}, found {len(scans)}.")
            return 2
        scan = scans[0]
        reason = _gate(scan.project)
        if reason:
            print(f"AI will not run for this scan: {reason}. Nothing was cached.")
            return 2
        if scan.status not in ("COMPLETED", "PARTIAL"):
            print(f"Scan {scan.id} is {scan.status}; only finished scans can be summarised.")
            return 2

        findings = select_top_findings(db, scan, args.limit)
        print(f"Scan {scan.id} ({scan.project.repo_name}, {scan.commit_sha[:7]}): warming {len(findings)} findings + summary")
        failures = 0
        for index, finding in enumerate(findings, start=1):
            result, ctx = explain_finding(db, scan, finding)
            source = ctx.code.source if ctx.code else "-"
            note = "cached" if result.cached else (result.reason or "new")
            print(f"  F{index:<2} {finding.severity:<8} {result.status:<9} {note:<15} code={source:<5} {finding.title[:60]}")
            failures += result.status != "VALIDATED"
            if result.reason == "RATE_LIMITED":
                print("Gemini quota reached; stopping so it is not spent further. Run again later to continue.")
                return 1
            if not result.cached:
                time.sleep(PAUSE_SECONDS)

        # Default limit, so the cache key matches the summary button and the report.
        result, _, _ = summarize_scan(db, scan)
        print(f"  summary  {result.status:<9} {'cached' if result.cached else (result.reason or 'new')}")
        failures += result.status != "VALIDATED"
        print("Done." if not failures else f"Done with {failures} fallback answer(s); run again later to retry them.")
        return 0 if not failures else 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
