"""
ARVE — Local to Cloud PostgreSQL Data Migration Tool

Usage:
    python scripts/migrate_to_cloud_db.py --target "postgresql://user:pass@host/dbname?sslmode=require"
    python scripts/migrate_to_cloud_db.py --source "sqlite:///arve.db" --target "postgresql://user:pass@host/dbname?sslmode=require"
"""

import sys
import argparse
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.models.models import Base, User, Repository, Project, Scan, TargetWebsite


def migrate_database(source_url: str, target_url: str):
    print("=" * 60)
    print("ARVE — Database Migration Tool")
    print("=" * 60)

    # Normalize URLs
    if source_url.startswith("postgres://"):
        source_url = "postgresql://" + source_url[len("postgres://"):]
    if target_url.startswith("postgres://"):
        target_url = "postgresql://" + target_url[len("postgres://"):]

    print(f"[+] Source DB : {source_url.split('@')[-1] if '@' in source_url else source_url}")
    print(f"[+] Target DB : {target_url.split('@')[-1] if '@' in target_url else target_url}")

    # Source connection
    src_connect_args = {"check_same_thread": False} if source_url.startswith("sqlite") else {}
    src_engine = create_engine(source_url, connect_args=src_connect_args)
    SrcSession = sessionmaker(bind=src_engine)
    src_db = SrcSession()

    # Target connection with SSL support
    tgt_connect_args = {}
    if target_url.startswith("postgresql") and ("sslmode" in target_url or any(d in target_url for d in ["neon.tech", "supabase.co", "render.com"])):
        tgt_connect_args["sslmode"] = "require"

    tgt_engine = create_engine(target_url, connect_args=tgt_connect_args, pool_pre_ping=True)
    TgtSession = sessionmaker(bind=tgt_engine)

    # Ensure tables exist on target Cloud DB
    print("\n[1/3] Creating tables on target Cloud PostgreSQL database...")
    Base.metadata.create_all(bind=tgt_engine)
    print("      [OK] Table schemas ready.")

    tgt_db = TgtSession()

    models = [User, Repository, Project, Scan, TargetWebsite]
    print("\n[2/3] Copying records...")

    try:
        total_migrated = 0
        for model in models:
            table_name = model.__tablename__
            records = src_db.query(model).all()
            if not records:
                print(f"      • {table_name:18s}: 0 records")
                continue

            count = 0
            for record in records:
                # Check if record already exists in target DB
                primary_key_val = getattr(record, "id")
                existing = tgt_db.query(model).filter(model.id == primary_key_val).first()
                if not existing:
                    # Detach from source session to add to target session
                    src_db.expunge(record)
                    tgt_db.add(record)
                    count += 1

            tgt_db.commit()
            total_migrated += count
            print(f"      [OK] {table_name:18s}: {count} new records copied (out of {len(records)})")

        print(f"\n[3/3] Migration finished successfully! Total records migrated: {total_migrated}")
        print("=" * 60)
    except Exception as e:
        tgt_db.rollback()
        print(f"\n[!] Migration failed: {e}")
        sys.exit(1)
    finally:
        src_db.close()
        tgt_db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate ARVE database to Cloud PostgreSQL.")
    parser.add_argument("--source", type=str, default=settings.database_url, help="Source database URL")
    parser.add_argument("--target", type=str, required=True, help="Target Cloud PostgreSQL URL")

    args = parser.parse_args()
    migrate_database(args.source, args.target)
