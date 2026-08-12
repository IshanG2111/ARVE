import sys
import os
import uuid
import datetime

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from app.core.database import SessionLocal, init_db
from app.models.models import User, Repository, Project, TargetWebsite, Scan

def seed():
    print("Initializing database tables...")
    init_db()
    db = SessionLocal()

    try:
        # Check if user already exists
        user = db.query(User).filter(User.email == "demo@arve.dev").first()
        if not user:
            print("Seeding demo user...")
            user = User(
                id=str(uuid.uuid4()),
                firebase_uid="demo_firebase_123",
                github_id="10293847",
                username="octocat-dev",
                email="demo@arve.dev",
                full_name="Octocat Security Tester",
                avatar_url="https://avatars.githubusercontent.com/u/583231?v=4",
                github_login="octocat-dev",
                github_avatar="https://avatars.githubusercontent.com/u/583231?v=4",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Check repository
        repo = db.query(Repository).filter(Repository.name == "sample-secure-app").first()
        if not repo:
            print("Seeding demo repository...")
            repo = Repository(
                id=str(uuid.uuid4()),
                github_repo_id="998877",
                owner="octocat-dev",
                name="sample-secure-app",
                full_name="octocat-dev/sample-secure-app",
                html_url="https://github.com/octocat-dev/sample-secure-app",
                default_branch="main",
                language="Python",
                description="Demo repository for vulnerability scanning and remediation",
                private=False
            )
            db.add(repo)
            db.commit()
            db.refresh(repo)

        # Check project
        project = db.query(Project).filter(Project.user_id == user.id).first()
        if not project:
            print("Seeding demo project...")
            project = Project(
                id=str(uuid.uuid4()),
                user_id=user.id,
                repository_id=repo.id,
                branch="main",
                deployment_url="http://localhost:8000/mock-verification-file",
                verified=True,
                name="Sample Security Project",
                description="ARVE Test Security Project"
            )
            db.add(project)
            db.commit()
            db.refresh(project)

        # Check target website
        target = db.query(TargetWebsite).filter(TargetWebsite.project_id == project.id).first()
        if not target:
            print("Seeding demo target website...")
            target = TargetWebsite(
                id=str(uuid.uuid4()),
                project_id=project.id,
                domain="localhost:8000",
                verification_token="arve-verify-demo-token-12345",
                is_verified=True,
                verified_at=datetime.datetime.now(datetime.timezone.utc)
            )
            db.add(target)
            db.commit()

        # Check scan
        scan = db.query(Scan).filter(Scan.project_id == project.id).first()
        if not scan:
            print("Seeding demo scan...")
            scan = Scan(
                id=str(uuid.uuid4()),
                project_id=project.id,
                status="completed"
            )
            db.add(scan)
            db.commit()

        print("\nDatabase seeded successfully with demo data!")
        print("Summary of entries in PostgreSQL (arve_db):")
        print(f"  - Users          : {db.query(User).count()}")
        print(f"  - Repositories   : {db.query(Repository).count()}")
        print(f"  - Projects       : {db.query(Project).count()}")
        print(f"  - TargetWebsites : {db.query(TargetWebsite).count()}")
        print(f"  - Scans          : {db.query(Scan).count()}")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
