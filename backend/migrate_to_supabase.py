"""
Ashro Living — SQLite to Supabase Migration Utility
Usage:
    export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
    python3 -m backend.migrate_to_supabase
"""

import os
import sys
import sqlite3
from pathlib import Path
from backend.config import DB_PATH, DATABASE_URL

def migrate():
    if not DATABASE_URL:
        print("❌ Error: DATABASE_URL environment variable is not set.")
        print("   Set your Supabase PostgreSQL connection string, e.g.:")
        print('   export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"')
        sys.exit(1)

    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("❌ Error: psycopg2-binary is not installed.")
        print("   Run: pip install psycopg2-binary")
        sys.exit(1)

    if not Path(DB_PATH).exists():
        print(f"❌ Error: SQLite source database not found at {DB_PATH}")
        sys.exit(1)

    print(f"🚀 Connecting to SQLite at: {DB_PATH}")
    sqlite_conn = sqlite3.connect(DB_PATH)
    sqlite_conn.row_factory = sqlite3.Row

    normalized_url = DATABASE_URL
    if normalized_url.startswith("postgres://"):
        normalized_url = "postgresql://" + normalized_url[len("postgres://"):]

    print("🚀 Connecting to Supabase PostgreSQL...")
    try:
        pg_conn = psycopg2.connect(normalized_url)
        pg_conn.autocommit = False
    except Exception as e:
        print("❌ Failed to connect to Supabase PostgreSQL:", e)
        sys.exit(1)

    # 1. Apply Supabase Schema
    schema_file = Path(__file__).parent / "schema_supabase.sql"
    if schema_file.exists():
        print("📦 Applying schema_supabase.sql to Supabase...")
        with open(schema_file, "r", encoding="utf-8") as f:
            schema_sql = f.read()
        with pg_conn.cursor() as cur:
            cur.execute(schema_sql)
        pg_conn.commit()
        print("✅ Tables created in Supabase.")

    # 2. Migrate tables in dependency order
    tables = [
        "properties",
        "rooms",
        "beds",
        "users",
        "visits",
        "bookings",
        "invoices",
        "tickets",
        "meal_menu",
        "meal_preferences",
        "notices",
        "inquiries",
        "kyc_records"
    ]

    for table in tables:
        try:
            s_cur = sqlite_conn.cursor()
            s_cur.execute(f"SELECT * FROM {table};")
            rows = s_cur.fetchall()
            if not rows:
                print(f"  • {table}: 0 rows (skipped)")
                continue

            columns = [col[0] for col in s_cur.description]
            col_names = ", ".join(columns)
            placeholders = ", ".join(["%s"] * len(columns))
            insert_sql = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING;"

            with pg_conn.cursor() as p_cur:
                for row in rows:
                    values = [row[c] for c in columns]
                    p_cur.execute(insert_sql, values)

            pg_conn.commit()
            print(f"  ✅ {table}: {len(rows)} records migrated successfully.")
        except Exception as e:
            pg_conn.rollback()
            print(f"  ⚠️ Warning on {table}: {e}")

    # Reset sequences for auto-increment IDs
    print("🔄 Synchronizing PostgreSQL auto-increment sequences...")
    with pg_conn.cursor() as p_cur:
        for table in tables:
            try:
                p_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 1)) FROM {table};")
            except Exception:
                pass
    pg_conn.commit()

    sqlite_conn.close()
    pg_conn.close()

    print("\n🎉 ALL DONE! Your SQLite data has been migrated to Supabase PostgreSQL permanently.")

if __name__ == "__main__":
    migrate()
