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

from app.models.models import Repository, AnalysisRun, RepositoryFile
from app.ingestion.github.client import (
    GitHubClient,
    GitHubAPIError,
    GitHubAuthenticationError,
    GitHubRateLimitError,
)
from app.ingestion.filters.file_filter import FileFilter
from app.ingestion.detector.language_detector import LanguageDetector
from app.ingestion.normalizer.normalizer import DataNormalizer

logger = logging.getLogger(__name__)


class IngestionService:
    """Orchestrates the full ingestion pipeline against real GitHub repositories."""

    def __init__(self, db: Session, max_file_size: int = 1_048_576):
        self.db = db
        self.file_filter = FileFilter(max_file_size=max_file_size)
        self.detector = LanguageDetector()
        self.normalizer = DataNormalizer()

    def create_analysis_run(self, repository_id: str, commit_sha: Optional[str] = None) -> AnalysisRun:
        """Create a PENDING analysis_run record."""
        analysis_run = AnalysisRun(
            repository_id=repository_id,
            commit_sha=commit_sha,
            status="PENDING",
            started_at=datetime.datetime.utcnow(),
        )
        self.db.add(analysis_run)
        self.db.commit()
        self.db.refresh(analysis_run)
        logger.info(f"[Ingestion] Created analysis run {analysis_run.id} for repository {repository_id}")
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

        repo = self.db.query(Repository).filter(Repository.id == run.repository_id).first()
        if not repo:
            run.status = "FAILED"
            run.error_message = "Repository record not found in database"
            self.db.commit()
            return run

        # Require a real token
        if not user_access_token:
            run.status = "FAILED"
            run.error_message = "GitHub access token is required — authenticate via GitHub OAuth first"
            self.db.commit()
            return run

        try:
            client = GitHubClient(access_token=user_access_token)

            # ── FETCHING ──────────────────────────────────────────────────
            run.status = "FETCHING"
            self.db.commit()
            logger.info(f"[Ingestion] FETCHING — run {run.id} for {repo.full_name}")

            # Resolve owner/name from full_name if not already set
            if not repo.owner or not repo.name:
                parts = repo.full_name.split("/")
                repo.owner = parts[0]
                repo.name = parts[1] if len(parts) > 1 else parts[0]

            # Fetch fresh metadata from GitHub and update DB record
            metadata = await client.get_repository_metadata(repo.owner, repo.name)
            repo.github_repo_id = metadata.id
            repo.html_url = metadata.html_url
            repo.default_branch = metadata.default_branch
            repo.language = metadata.language
            repo.description = metadata.description
            repo.private = metadata.private
            repo.visibility = metadata.visibility
            repo.size_kb = metadata.size_kb
            self.db.commit()

            logger.info(
                f"[Ingestion] Repository metadata: {repo.full_name} | "
                f"branch={repo.default_branch} | language={repo.language} | "
                f"private={repo.private} | size={repo.size_kb}KB"
            )

            # Get latest commit SHA
            branch = repo.default_branch or "main"
            if not run.commit_sha:
                commit_info = await client.get_latest_commit(repo.owner, repo.name, branch)
                run.commit_sha = commit_info.sha
                logger.info(f"[Ingestion] Commit: {commit_info.sha[:12]} — {commit_info.message}")

            # ── PROCESSING ────────────────────────────────────────────────
            run.status = "PROCESSING"
            self.db.commit()
            logger.info(f"[Ingestion] PROCESSING — fetching tree for commit {run.commit_sha[:12]}")

            # Get file tree
            tree_entries = await client.get_repository_tree(repo.owner, repo.name, run.commit_sha)
            blob_entries = [e for e in tree_entries if e.type == "blob"]
            run.files_found = len(blob_entries)
            logger.info(f"[Ingestion] Files discovered: {run.files_found}")

            files_ingested_count = 0
            files_skipped_count = 0
            language_counts: Dict[str, int] = {}
            file_records = []

            # Process each file through filter → detect → fetch → normalize → hash
            for entry in blob_entries:
                filter_result = self.file_filter.evaluate(path=entry.path, size=entry.size)
                lang = self.detector.detect(entry.path)

                if not filter_result.should_ingest:
                    norm_file = self.normalizer.create_normalized_file(
                        path=entry.path,
                        content=None,
                        size=entry.size,
                        language=lang,
                        status="SKIPPED",
                        skip_reason=filter_result.skip_reason,
                    )
                    files_skipped_count += 1
                else:
                    try:
                        file_data = await client.get_file_content(
                            owner=repo.owner,
                            repo=repo.name,
                            path=entry.path,
                            ref=run.commit_sha,
                        )
                        norm_file = self.normalizer.create_normalized_file(
                            path=entry.path,
                            content=file_data.content,
                            size=file_data.size,
                            language=lang,
                            status="INGESTED",
                        )
                        files_ingested_count += 1
                        language_counts[lang] = language_counts.get(lang, 0) + 1
                    except GitHubRateLimitError:
                        # If we hit rate limit mid-ingestion, fail the entire run
                        raise
                    except Exception as file_err:
                        logger.warning(f"[Ingestion] Failed to fetch {entry.path}: {file_err}")
                        norm_file = self.normalizer.create_normalized_file(
                            path=entry.path,
                            content=None,
                            size=entry.size,
                            language=lang,
                            status="FAILED",
                            skip_reason=str(file_err),
                        )
                        files_skipped_count += 1

                db_file = RepositoryFile(
                    repository_id=repo.id,
                    analysis_run_id=run.id,
                    path=norm_file.path,
                    filename=norm_file.filename,
                    extension=norm_file.extension,
                    language=norm_file.language,
                    size=norm_file.size,
                    sha256=norm_file.sha256,
                    content=norm_file.content,
                    status=norm_file.status,
                    skip_reason=norm_file.skip_reason,
                )
                file_records.append(db_file)

            # ── PERSIST & COMPLETE ────────────────────────────────────────
            self.db.bulk_save_objects(file_records)
            run.files_ingested = files_ingested_count
            run.files_skipped = files_skipped_count
            run.languages_summary = json.dumps(language_counts)
            run.status = "COMPLETED"
            run.completed_at = datetime.datetime.utcnow()
            self.db.commit()
            self.db.refresh(run)

            logger.info(
                f"[Ingestion] COMPLETED — run {run.id}\n"
                f"  Repository: {repo.full_name}\n"
                f"  Commit:     {run.commit_sha}\n"
                f"  Files found:    {run.files_found}\n"
                f"  Files ingested: {files_ingested_count}\n"
                f"  Files skipped:  {files_skipped_count}\n"
                f"  Languages:      {language_counts}"
            )
            return run

        except GitHubAuthenticationError as auth_err:
            logger.error(f"[Ingestion] Authentication failed: {auth_err}")
            run.status = "FAILED"
            run.error_message = f"GitHub authentication failed: {auth_err}"
            self.db.commit()
            return run

        except GitHubRateLimitError as rl_err:
            logger.error(f"[Ingestion] Rate limit exceeded: {rl_err}")
            run.status = "FAILED"
            run.error_message = f"GitHub API rate limit exceeded: {rl_err}"
            self.db.commit()
            return run

        except GitHubAPIError as api_err:
            logger.error(f"[Ingestion] GitHub API error: {api_err}")
            run.status = "FAILED"
            run.error_message = f"GitHub API error: {api_err}"
            self.db.commit()
            return run

        except Exception as e:
            logger.exception(f"[Ingestion] Pipeline failed for run {run.id}: {e}")
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
