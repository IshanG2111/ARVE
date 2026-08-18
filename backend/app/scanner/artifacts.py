"""Cloud-only raw scanner artifact storage for ARVE.

Scanner containers write into a temporary scan workspace. The orchestration
worker uploads those outputs to Backblaze B2 through its S3-compatible API.
PostgreSQL stores only the returned B2 object-prefix reference; raw artifacts
are never persisted on the worker filesystem after the scan cleanup.

The storage contract is intentionally scanner-agnostic so Phase 4 can store
Semgrep SARIF, OSV JSON, Gitleaks JSON, or other native raw outputs without
changing orchestration.
"""
from __future__ import annotations

import hashlib
import mimetypes
import posixpath
import re
import shutil
from pathlib import Path
from typing import Any

import boto3
from botocore.config import Config

from app.core.config import settings
from app.scanner.exceptions import ScanOrchestrationError


class ScanArtifactStore:
    """Persist scanner output directly to Backblaze B2."""

    def __init__(self, client: Any | None = None):
        # Configuration is validated lazily so API/unit-test code can create
        # the orchestration service without opening a network connection.
        self.bucket = settings.B2_BUCKET_NAME
        self.endpoint = settings.B2_ENDPOINT
        self.region = settings.B2_REGION
        self.access_key_id = settings.B2_ACCESS_KEY_ID
        self.secret_access_key = settings.B2_SECRET_ACCESS_KEY
        self.prefix = self._safe_prefix(settings.B2_ARTIFACT_PREFIX)
        self.client = client

    def _get_client(self) -> Any:
        if self.client is not None:
            return self.client

        missing = [
            name
            for name, value in (
                ("B2_ENDPOINT", self.endpoint),
                ("B2_REGION", self.region),
                ("B2_BUCKET_NAME", self.bucket),
                ("B2_ACCESS_KEY_ID", self.access_key_id),
                ("B2_SECRET_ACCESS_KEY", self.secret_access_key),
            )
            if not value
        ]
        if missing:
            raise ScanOrchestrationError(
                "Backblaze B2 artifact storage is not configured: "
                + ", ".join(missing)
            )

        self.client = boto3.client(
            "s3",
            endpoint_url=self.endpoint.rstrip("/"),
            region_name=self.region,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
            ),
        )
        return self.client

    @staticmethod
    def _safe_segment(value: str, fallback: str = "engine") -> str:
        safe = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip(".")
        return safe[:128] or fallback

    @classmethod
    def _safe_prefix(cls, prefix: str) -> str:
        normalized = (prefix or "scans").replace("\\", "/").strip("/")
        parts = [part for part in normalized.split("/") if part not in {"", ".", ".."}]
        if not parts:
            return "scans"
        if any(":" in part for part in parts):
            raise ScanOrchestrationError("Invalid B2 artifact prefix")
        return "/".join(cls._safe_segment(part, "scans") for part in parts)

    def _object_prefix(self, scan_id: str, engine_name: str) -> str:
        return posixpath.join(
            self.prefix,
            self._safe_segment(scan_id, "scan"),
            self._safe_segment(engine_name),
        )

    @staticmethod
    def _iter_files(output_dir: Path) -> list[Path]:
        if not output_dir.exists() or not output_dir.is_dir():
            return []
        return sorted(path for path in output_dir.rglob("*") if path.is_file())

    @staticmethod
    def _content_type(path: Path) -> str:
        content_type, _ = mimetypes.guess_type(path.name)
        if path.suffix.lower() == ".sarif":
            return "application/sarif+json"
        return content_type or "application/octet-stream"

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def persist_output(self, scan_id: str, engine_name: str, output_dir: Path) -> str | None:
        """Upload every output file and return its B2 object prefix.

        The source is the temporary Docker output directory. Nothing under
        B2 is made public. The caller owns temporary workspace cleanup.
        """
        files = self._iter_files(output_dir)
        if not files:
            return None

        object_prefix = self._object_prefix(scan_id, engine_name)

        client = self._get_client()
        if not self.bucket:
            raise ScanOrchestrationError("B2_BUCKET_NAME is not configured")
        try:
            for file_path in files:
                relative = file_path.relative_to(output_dir).as_posix()
                relative_parts = [
                    part for part in relative.split("/")
                    if part not in {"", ".", ".."}
                ]
                if not relative_parts or any(":" in part for part in relative_parts):
                    raise ScanOrchestrationError(
                        f"Invalid scanner artifact path: {relative}"
                    )

                key = posixpath.join(
                    object_prefix,
                    *[self._safe_segment(part, "artifact") for part in relative_parts],
                )
                metadata = {
                    "sha256": self._sha256(file_path),
                    "scan-id": str(scan_id),
                    "engine": self._safe_segment(engine_name),
                }
                client.upload_file(
                    str(file_path),
                    self.bucket,
                    key,
                    ExtraArgs={
                        "ContentType": self._content_type(file_path),
                        "Metadata": metadata,
                    },
                )
        except ScanOrchestrationError:
            raise
        except Exception as exc:
            raise ScanOrchestrationError(
                f"Failed to upload scanner artifacts to Backblaze B2: {exc}"
            ) from exc

        # The scanner output is no longer needed locally once every object is
        # durably stored in B2. Workspace cleanup remains the final safety net.
        try:
            shutil.rmtree(output_dir)
        except OSError as exc:
            raise ScanOrchestrationError(
                f"Artifacts uploaded to B2 but local scanner output cleanup failed: {exc}"
            ) from exc

        # This is a logical object-prefix reference, not a local filesystem path.
        return f"b2://{self.bucket}/{object_prefix}"

    def delete_scan_artifacts(self, scan_id: str) -> None:
        """Delete all B2 objects for one scan.

        This is intentionally explicit; normal scan execution does not delete
        artifacts because Phase 5 needs them. Use it for retention/cleanup.
        """
        prefix = posixpath.join(
            self.prefix,
            self._safe_segment(scan_id, "scan"),
        ) + "/"

        try:
            client = self._get_client()
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                objects = [{"Key": item["Key"]} for item in page.get("Contents", [])]
                if objects:
                    client.delete_objects(
                        Bucket=self.bucket,
                        Delete={"Objects": objects, "Quiet": True},
                    )
        except Exception as exc:
            raise ScanOrchestrationError(
                f"Failed to delete Backblaze B2 artifacts for scan {scan_id}: {exc}"
            ) from exc

    def list_scan_artifacts(self, scan_id: str) -> list[str]:
        """Return B2 object keys for an authorized server-side caller."""
        prefix = posixpath.join(
            self.prefix,
            self._safe_segment(scan_id, "scan"),
        ) + "/"
        keys: list[str] = []
        try:
            client = self._get_client()
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                keys.extend(item["Key"] for item in page.get("Contents", []))
        except Exception as exc:
            raise ScanOrchestrationError(
                f"Failed to list Backblaze B2 artifacts for scan {scan_id}: {exc}"
            ) from exc
        return keys

    def presigned_get_url(self, object_key: str, expires_seconds: int = 300) -> str:
        """Create a short-lived download URL for an authorized backend caller."""
        if not object_key.startswith(self.prefix + "/"):
            raise ScanOrchestrationError("Invalid B2 artifact key")
        try:
            client = self._get_client()
            return client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": object_key},
                ExpiresIn=max(1, min(expires_seconds, 3600)),
            )
        except Exception as exc:
            raise ScanOrchestrationError(
                f"Failed to generate Backblaze B2 artifact URL: {exc}"
            ) from exc
