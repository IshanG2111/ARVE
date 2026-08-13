"""Development seed data for the project-scoped repository model."""
import datetime
import uuid

from app.core.database import SessionLocal
from app.models.models import Project, Scan, TargetWebsite, User


def generate_uuid():
    return str(uuid.uuid4())


def seed():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "demo@arve.local").first()
        if not user:
            user = User(
                id=generate_uuid(),
                firebase_uid="seed-firebase-user",
                email="demo@arve.local",
                username="arve-demo",
                github_login="arve-demo",
                full_name="ARVE Demo User",
                is_active=True,
            )
            db.add(user)
            db.flush()

        project = db.query(Project).filter(Project.name == "Sample Security Project", Project.user_id == user.id).first()
        if not project:
            project = Project(
                id=generate_uuid(),
                user_id=user.id,
                name="Sample Security Project",
                description="Development seed project",
                branch="main",
                repo_id="seed-repo-001",
                repo_owner="arve-demo",
                repo_name="arve-demo/sample-secure-app",
                repo_url="https://github.com/arve-demo/sample-secure-app",
                default_branch="main",
                repo_language="TypeScript",
                repo_description="Sample application for local development",
                repo_private=False,
                repo_visibility="public",
                repo_size_kb=0,
                created_at=datetime.datetime.utcnow(),
            )
            db.add(project)
            db.flush()

            db.add(
                TargetWebsite(
                    id=generate_uuid(),
                    project_id=project.id,
                    domain="example.com",
                )
            )
            db.add(
                Scan(
                    id=generate_uuid(),
                    project_id=project.id,
                    status="pending",
                )
            )

        db.commit()
        print("Seed completed successfully.")
        print(f"  - Users      : {db.query(User).count()}")
        print(f"  - Projects   : {db.query(Project).count()}")
        print(f"  - Targets    : {db.query(TargetWebsite).count()}")
        print(f"  - Scans      : {db.query(Scan).count()}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
