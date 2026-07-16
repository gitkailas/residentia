#!/bin/bash
# Test PostgreSQL connection and verify all tables exist

PGPASSWORD="ResidentiaPass123!" psql -U residentia_user -h localhost -p 5432 -d residentia << EOF

-- Test connection and show tables
\echo "=== DATABASE CONNECTION TEST ==="
SELECT 'Connected successfully!' as status;

-- List all tables
\echo "\n=== DATABASE TABLES ==="
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Show row counts for each table
\echo "\n=== TABLE ROW COUNTS ==="
SELECT 'users' as table_name, COUNT(*) as row_count FROM public.users
UNION ALL
SELECT 'user_roles', COUNT(*) FROM public.user_roles
UNION ALL
SELECT 'units', COUNT(*) FROM public.units
UNION ALL
SELECT 'billing_cycles', COUNT(*) FROM public.billing_cycles
UNION ALL
SELECT 'payments', COUNT(*) FROM public.payments
UNION ALL
SELECT 'queries', COUNT(*) FROM public.queries
UNION ALL
SELECT 'waivers', COUNT(*) FROM public.waivers
UNION ALL
SELECT 'announcements', COUNT(*) FROM public.announcements;

-- Show sample data
\echo "\n=== SAMPLE USERS ==="
SELECT id, email, role FROM public.users LIMIT 3;

\echo "\n=== SAMPLE UNITS ==="
SELECT unit_no, owner_name, owner_email, status FROM public.units LIMIT 5;

EOF
