-- SQL initialization for Residentia local Postgres
-- Run with: psql -U postgres -f sql/init_postgres.sql

CREATE USER residentia_user WITH PASSWORD 'ResidentiaPass123!';
CREATE DATABASE residentia OWNER residentia_user;
GRANT ALL PRIVILEGES ON DATABASE residentia TO residentia_user;
