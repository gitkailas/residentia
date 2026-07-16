#!/usr/bin/env python3
"""
Create PostgreSQL database and user for Residentia without needing psql password.
Uses psycopg2 to connect directly.
"""
import sys
import subprocess

try:
    import psycopg2
    from psycopg2 import sql, OperationalError
except ImportError:
    print("Installing psycopg2...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary"])
    import psycopg2
    from psycopg2 import sql, OperationalError

def create_database():
    db_name = "residentia"
    db_user = "residentia_user"
    db_password = "ResidentiaPass123!"
    db_port = 5432
    db_host = "localhost"

    # Try connecting as postgres first (superuser)
    try:
        print("Attempting to connect as postgres superuser...")
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            user="postgres",
            password="",
            dbname="postgres"
        )
        print("✓ Connected as postgres (empty password)")
    except OperationalError as e:
        print(f"✗ Connection as postgres failed: {e}")
        # Try with common default password
        try:
            print("Attempting to connect as postgres with common default...")
            conn = psycopg2.connect(
                host=db_host,
                port=db_port,
                user="postgres",
                password="postgres",
                dbname="postgres"
            )
            print("✓ Connected as postgres (password: postgres)")
        except OperationalError as e2:
            print(f"✗ Connection failed: {e2}")
            print("Cannot connect to PostgreSQL. Please ensure:")
            print("  1. PostgreSQL service is running")
            print("  2. Port 5432 is accessible")
            print("  3. The postgres superuser password is either empty or 'postgres'")
            return False

    conn.autocommit = True
    cursor = conn.cursor()

    try:
        # Create role if not exists
        print(f"Creating role {db_user}...")
        cursor.execute(sql.SQL("""
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = %s) THEN
                CREATE ROLE {} WITH LOGIN PASSWORD %s;
              ELSE
                ALTER ROLE {} WITH PASSWORD %s;
              END IF;
            END
            $$;
        """).format(
            sql.Identifier(db_user),
            sql.Identifier(db_user)
        ), [db_user, db_password, db_password])
        print(f"✓ Role {db_user} created or updated")

        # Create database if not exists
        print(f"Creating database {db_name}...")
        cursor.execute(sql.SQL("""
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT FROM pg_database WHERE datname = %s) THEN
                CREATE DATABASE {} OWNER {};
              END IF;
            END
            $$;
        """).format(
            sql.Identifier(db_name),
            sql.Identifier(db_user)
        ), [db_name])
        print(f"✓ Database {db_name} created or verified")

        # Grant privileges
        print(f"Granting privileges to {db_user}...")
        cursor.execute(sql.SQL("GRANT ALL PRIVILEGES ON DATABASE {} TO {}").format(
            sql.Identifier(db_name),
            sql.Identifier(db_user)
        ))
        print(f"✓ Privileges granted")

        cursor.close()
        conn.close()

        print("\n✓ Database setup complete!")
        print(f"\nUse these credentials in your .env file:")
        print(f"DATABASE_URL=postgres://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}")
        return True

    except Exception as e:
        print(f"✗ Error during database creation: {e}")
        cursor.close()
        conn.close()
        return False

if __name__ == "__main__":
    success = create_database()
    sys.exit(0 if success else 1)
