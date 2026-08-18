"""
Ingestion Service & Pipeline Orchestrator for ARVE.
Connects to GitHub via real access token, fetches repository tree,
filters files, detects languages, computes SHA-256 hashes, normalizes data,
and persists everything to the database.

No mock data. No synthetic content. Real GitHub data only.
"""
import datetime
import json
import logging
from typing import Dict, Optional
from sqlalchemy.orm import Session

from app.models.models import Project, AnalysisRun, RepositoryFile
from app.ingestion.github.client import (
    GitHubClient,
    GitHubAPIError,
    GitHubAuthenticationError,
    GitHubRateLimitError,
)
from app.ingestion.filters.file_filter import FileFilter
from app.ingestion.detector.language_detector import LanguageDetector
from app.ingestion.detector.framework_detector import FrameworkDetector
from app.ingestion.normalizer.normalizer import DataNormalizer

logger = logging.getLogger(__name__)


class IngestionService:
    """Orchestrates the full ingestion pipeline against real GitHub repositories."""

    def __init__(self, db: Session, max_file_size: int = 1_048_576):
        self.db = db
        self.file_filter = FileFilter(max_file_size=max_file_size)
        self.detector = LanguageDetector()
        self.normalizer = DataNormalizer()

    def create_analysis_run(self, project_id: str, commit_sha: Optional[str] = None) -> AnalysisRun:
        """Create a PENDING analysis_run record."""
        analysis_run = AnalysisRun(
            project_id=project_id,
            commit_sha=commit_sha,
            status="PENDING",
            started_at=datetime.datetime.utcnow(),
        )
        self.db.add(analysis_run)
        self.db.commit()
        self.db.refresh(analysis_run)
        logger.info(f"[Ingestion] Created analysis run {analysis_run.id} for project {project_id}")
        return analysis_run

    async def execute_ingestion_pipeline(
        self,
        analysis_run_id: str,
        user_access_token: str,
    ) -> AnalysisRun:
        """
        Runs the full pipeline:
        PENDING → FETCHING → PROCESSING → COMPLETED (or FAILED)

        Requires a real GitHub access token — no fallbacks.
        """
        run = self.db.query(AnalysisRun).filter(AnalysisRun.id == analysis_run_id).first()
        if not run:
            logger.error(f"[Ingestion] Analysis run {analysis_run_id} not found")
            return None

        project = self.db.query(Project).filter(Project.id == run.project_id).first()
        if not project:
            run.status = "FAILED"
            run.error_message = "Project record not found in database"
            self.db.commit()
            return run

        # Connect to GitHub API (supports public repos if token is empty or mock)
        try:
            client = GitHubClient(access_token=user_access_token)

            # ── FETCHING ──────────────────────────────────────────────────
            run.status = "FETCHING"
            self.db.commit()
            logger.info(f"[Ingestion] FETCHING — run {run.id} for {project.repo_name}")

            # Resolve owner/name from the project's denormalized full_name.
            full_name = (project.repo_name or "").strip()
            parts = full_name.split("/", 1)
            owner = project.repo_owner or (parts[0] if parts else "")
            repo_name = parts[1] if len(parts) > 1 else (parts[0] if parts else "")
            if not owner or not repo_name:
                raise ValueError("Project does not contain a valid GitHub repository owner/name")
            project.repo_owner = owner
            project.repo_name = f"{owner}/{repo_name}"

            # Fetch fresh metadata from GitHub and update DB record
            metadata = await client.get_repository_metadata(owner, repo_name)
            project.repo_id = metadata.id
            project.repo_url = metadata.html_url
            project.default_branch = metadata.default_branch
            project.repo_language = metadata.language
            project.repo_description = metadata.description
            project.repo_private = metadata.private
            project.repo_visibility = metadata.visibility
            project.repo_size_kb = metadata.size_kb
            self.db.commit()

            logger.info(
                f"[Ingestion] Repository metadata: {project.repo_name} | "
                f"branch={project.default_branch} | language={project.repo_language} | "
                f"private={project.repo_private} | size={project.repo_size_kb}KB"
            )

            # Get latest commit SHA
            branch = project.default_branch or project.branch or "main"
            if not run.commit_sha:
                commit_info = await client.get_latest_commit(owner, repo_name, branch)
                run.commit_sha = commit_info.sha
                logger.info(f"[Ingestion] Commit: {commit_info.sha[:12]} — {commit_info.message}")

            # ── PROCESSING ────────────────────────────────────────────────
            run.status = "PROCESSING"
            self.db.commit()
            logger.info(f"[Ingestion] PROCESSING — fetching tree for commit {run.commit_sha[:12]}")

            # Get file tree
            tree_entries = await client.get_repository_tree(owner, repo_name, run.commit_sha)
            blob_entries = [e for e in tree_entries if e.type == "blob"]
            run.files_found = len(blob_entries)
            logger.info(f"[Ingestion] Files discovered: {run.files_found}")

            # Evaluate file filter rules first
            evaluated_entries = [
                (e, self.file_filter.evaluate(path=e.path, size=e.size), self.detector.detect(e.path))
                for e in blob_entries
            ]
            ingestible_entries = [(e, f_res, lang) for e, f_res, lang in evaluated_entries if f_res.should_ingest]
            skipped_entries = [(e, f_res, lang) for e, f_res, lang in evaluated_entries if not f_res.should_ingest]

            # Enforce Ingestion Guards strictly on ingestible source files
            if len(ingestible_entries) > 5000:
                raise ValueError(f"Repository exceeds file limit: {len(ingestible_entries)} source files (limit: 5000)")

            total_ingestible_bytes = sum(e.size for e, _, _ in ingestible_entries if e.size)
            if total_ingestible_bytes > 209_715_200:
                raise ValueError(f"Repository source code exceeds size limit: {total_ingestible_bytes / (1024 * 1024):.1f}MB (limit: 200MB)")

            file_contents_map: Dict[str, str] = {}
            package_json_content = None
            requirements_txt_content = None
            pyproject_toml_content = None
            go_mod_content = None

            # Attempt 1: Fast tarball streaming (for authenticated GitHub tokens)
            if user_access_token and user_access_token.startswith("ghp_"):
                try:
                    tarball_bytes = await client.download_repository_tarball(owner, repo_name, run.commit_sha)
                    import tarfile
                    import io
                    with tarfile.open(fileobj=io.BytesIO(tarball_bytes), mode="r:gz") as tar:
                        for member in tar.getmembers():
                            if member.isfile():
                                parts = member.name.split("/", 1)
                                clean_path = parts[1] if len(parts) > 1 else member.name
                                f_obj = tar.extractfile(member)
                                if f_obj:
                                    raw_bytes = f_obj.read()
                                    try:
                                        content_str = raw_bytes.decode("utf-8")
                                    except UnicodeDecodeError:
                                        content_str = raw_bytes.decode("latin-1", errors="replace")
                                    file_contents_map[clean_path] = content_str
                    logger.info(f"[Ingestion] Fast Tarball stream extracted {len(file_contents_map)} files in memory")
                except Exception as tar_err:
                    logger.warning(f"[Ingestion] Tarball stream unavailable: {tar_err}. Falling back to concurrent batch fetching.")

            # Attempt 2: Concurrent batch fallback if tarball stream wasn't populated
            if not file_contents_map and ingestible_entries:
                import asyncio
                import httpx
                semaphore = asyncio.Semaphore(15)
                async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as http_pool:
                    async def fetch_single_file(e_entry):
                        async with semaphore:
                            try:
                                f_data = await client.get_file_content(
                                    project.repo_owner, project.repo_name.split("/", 1)[-1] if project.repo_name else "", e_entry.path, run.commit_sha, client=http_pool
                                )
                                return e_entry.path, f_data.content
                            except Exception as file_err:
                                logger.warning(f"[Ingestion] Failed to fetch {e_entry.path}: {file_err}")
                                return e_entry.path, None

                    tasks = [fetch_single_file(e) for e, _, _ in ingestible_entries]
                    results = await asyncio.gather(*tasks)
                    for path, content in results:
                        if content is not None:
                            file_contents_map[path] = content

            # Build database records
            file_records = []
            files_ingested_count = 0
            files_skipped_count = len(skipped_entries)
            language_counts: Dict[str, int] = {}

            # Add skipped file records
            for entry, filter_result, lang in skipped_entries:
                norm_file = self.normalizer.create_normalized_file(
                    path=entry.path,
                    content=None,
                    size=entry.size,
                    language=lang,
                    status="SKIPPED",
                    skip_reason=filter_result.skip_reason,
                )
                file_records.append(
                    RepositoryFile(
                        project_id=project.id,
                        analysis_run_id=run.id,
                        path=norm_file.path,
                        filename=norm_file.filename,
                        extension=norm_file.extension,
                        language=norm_file.language,
                        size=norm_file.size,
                        sha256=norm_file.sha256,
                        content=None,
                        status=norm_file.status,
                        skip_reason=norm_file.skip_reason,
                    )
                )

            # Add ingested file records
            for entry, filter_result, lang in ingestible_entries:
                content = file_contents_map.get(entry.path)
                if content is not None:
                    norm_file = self.normalizer.create_normalized_file(
                        path=entry.path,
                        content=content,
                        size=len(content.encode("utf-8")),
                        language=lang,
                        status="INGESTED",
                    )
                    files_ingested_count += 1
                    language_counts[lang] = language_counts.get(lang, 0) + 1

                    # Capture manifests
                    path_lower = entry.path.lower()
                    if path_lower.endswith("package.json"):
                        package_json_content = content
                    elif path_lower.endswith("requirements.txt"):
                        requirements_txt_content = content
                    elif path_lower.endswith("pyproject.toml"):
                        pyproject_toml_content = content
                    elif path_lower.endswith("go.mod"):
                        go_mod_content = content

                    file_records.append(
                        RepositoryFile(
                            project_id=project.id,
                            analysis_run_id=run.id,
                            path=norm_file.path,
                            filename=norm_file.filename,
                            extension=norm_file.extension,
                            language=norm_file.language,
                            size=norm_file.size,
                            sha256=norm_file.sha256,
                            content=norm_file.content,
                            status=norm_file.status,
                            skip_reason=None,
                        )
                    )
                else:
                    files_skipped_count += 1

            # ── PERSIST & COMPLETE ────────────────────────────────────────
            # Persist files under this immutable analysis run. Do not delete
            # previous runs: Phase 3 scans are pinned to a specific AnalysisRun
            # and must remain reproducible after later ingestions.
            self.db.query(RepositoryFile).filter(RepositoryFile.analysis_run_id == run.id).delete(
                synchronize_session=False
            )
            self.db.bulk_save_objects(file_records)

            # Detect package manager
            file_paths = [e.path for e in blob_entries]
            package_manager = FrameworkDetector.detect_package_manager(file_paths)

            # Detect frameworks across ecosystems
            detected_frameworks = FrameworkDetector.detect_frameworks(
                package_json_content=package_json_content,
                requirements_txt_content=requirements_txt_content,
                pyproject_toml_content=pyproject_toml_content,
                go_mod_content=go_mod_content,
            )
            frameworks_str = ", ".join(detected_frameworks) if detected_frameworks else None

            run.files_ingested = files_ingested_count
            run.files_skipped = files_skipped_count
            run.languages_summary = json.dumps(language_counts)
            run.frameworks = frameworks_str
            run.package_manager = package_manager
            run.status = "COMPLETED"
            run.completed_at = datetime.datetime.utcnow()

            # Update repository state
            project.repo_frameworks = frameworks_str
            project.repo_package_manager = package_manager

            self.db.commit()
            self.db.refresh(run)

            logger.info(
                f"[Ingestion] COMPLETED — run {run.id}\n"
                f"  Repository: {project.repo_name}\n"
                f"  Commit:     {run.commit_sha}\n"
                f"  Files found:    {run.files_found}\n"
                f"  Files ingested: {files_ingested_count}\n"
                f"  Files skipped:  {files_skipped_count}\n"
                f"  Languages:      {language_counts}\n"
                f"  Frameworks:     {frameworks_str}\n"
                f"  Package Mgr:    {package_manager}"
            )
            return run

        except GitHubAuthenticationError as auth_err:
            logger.error(f"[Ingestion] Authentication failed: {auth_err}")
            self.db.rollback()
            run = self.db.query(AnalysisRun).filter(AnalysisRun.id == analysis_run_id).first()
            if run:
                run.status = "FAILED"
                run.error_message = f"GitHub authentication failed: {auth_err}"
                self.db.commit()
            return run

        except GitHubRateLimitError as rl_err:
            logger.error(f"[Ingestion] Rate limit exceeded: {rl_err}")
            self.db.rollback()
            run = self.db.query(AnalysisRun).filter(AnalysisRun.id == analysis_run_id).first()
            if run:
                run.status = "FAILED"
                run.error_message = f"GitHub API rate limit exceeded: {rl_err}"
                self.db.commit()
            return run

        except GitHubAPIError as api_err:
            logger.error(f"[Ingestion] GitHub API error: {api_err}")
            self.db.rollback()
            run = self.db.query(AnalysisRun).filter(AnalysisRun.id == analysis_run_id).first()
            if run:
                run.status = "FAILED"
                run.error_message = f"GitHub API error: {api_err}"
                self.db.commit()
            return run

        except Exception as e:
            logger.exception(f"[Ingestion] Pipeline failed for run {analysis_run_id}: {e}")
            self.db.rollback()
            run = self.db.query(AnalysisRun).filter(AnalysisRun.id == analysis_run_id).first()
            if run:
                run.status = "FAILED"
                run.error_message = str(e)
                self.db.commit()
            return run


async def run_ingestion_background(db_factory, analysis_run_id: str, access_token: str):
    """Background task wrapper — creates isolated DB session for the pipeline."""
    db = db_factory()
    try:
        service = IngestionService(db)
        await service.execute_ingestion_pipeline(
            analysis_run_id=analysis_run_id,
            user_access_token=access_token,
        )
    finally:
        db.close()
