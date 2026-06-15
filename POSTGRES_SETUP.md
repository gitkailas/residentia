# Residentia - PostgreSQL Database Setup & API Integration

## Overview

Residentia has been successfully migrated from Supabase to a pure PostgreSQL backend with JWT authentication. All API communications are now handled through a custom server-side Postgres integration.

## Database Setup Status ✅

### Connection Details
- **Host:** localhost
- **Port:** 5432
- **Database:** residentia
- **User:** residentia_user
- **Password:** ResidentiaPass123!
- **Connection String:** `postgres://residentia_user:ResidentiaPass123!@localhost:5432/residentia`

### Database Tables Created

| Table | Purpose | Status |
|-------|---------|--------|
| `users` | User authentication with passwords and roles | ✅ Ready |
| `user_roles` | Role-based access control (admin/resident) | ✅ Ready |
| `units` | Apartment unit information and details | ✅ Ready |
| `billing_cycles` | Monthly billing periods | ✅ Ready |
| `payments` | Payment records and transactions | ✅ Ready |
| `queries` | Support tickets from residents | ✅ Ready |
| `waivers` | Payment waivers for units | ✅ Ready |
| `announcements` | Community announcements | ✅ Ready |

All tables have been created with:
- UUID primary keys
- Timestamps (created_at, updated_at)
- Appropriate indexes for performance
- Foreign key relationships
- Sample seed data for testing

## API Architecture

### Authentication Flow

```
Client Login Request
    ↓
POST /api/auth/login (email, password)
    ↓
Postgres: Lookup user by email
    ↓
Verify bcrypt password hash
    ↓
Generate JWT token (7 days expiry)
    ↓
Return token to client
    ↓
Client stores JWT in localStorage
    ↓
All subsequent requests include: Authorization: Bearer {token}
```

### Database Query Flow

```
Client Query Request
    ↓
POST /api/db (with JWT token)
    ↓
Server: Verify JWT token
    ↓
Build SQL query (SELECT, INSERT, UPDATE, DELETE)
    ↓
Execute against Postgres
    ↓
Return JSON response to client
```

## API Endpoints

### Authentication

**POST /api/auth/login**
```json
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "data": {
    "session": {
      "access_token": "eyJhbGc...",
      "expires_at": 1720000000,
      "user": {
        "id": "uuid",
        "email": "user@example.com"
      }
    }
  }
}
```

### Database Operations

**POST /api/db**

All database operations use a unified request format:

```json
Request:
{
  "op": "select|insert|update|delete|upsert",
  "table": "table_name",
  "select": "*" or "column1, column2",
  "filters": [{"type": "eq", "column": "id", "value": "uuid"}],
  "order": [{"column": "created_at", "ascending": false}],
  "limit": 10,
  "data": {...},
  "single": true,
  "maybeSingle": true
}
```

#### Example Queries

**Fetch all units:**
```json
{
  "op": "select",
  "table": "units",
  "select": "*",
  "order": [{"column": "floor"}, {"column": "unit_no"}]
}
```

**Create a payment:**
```json
{
  "op": "insert",
  "table": "payments",
  "data": {
    "unit_id": "uuid",
    "billing_cycle_id": "uuid",
    "total_paid": 5000,
    "payment_mode": "bank_transfer"
  }
}
```

**Update a query status:**
```json
{
  "op": "update",
  "table": "queries",
  "data": {
    "status": "resolved",
    "admin_reply": "Issue has been resolved"
  },
  "filters": [{"type": "eq", "column": "id", "value": "uuid"}]
}
```

**Fetch with relationships (nested data):**
```json
{
  "op": "select",
  "table": "payments",
  "select": "*, units(unit_no, owner_name)",
  "order": [{"column": "created_at", "ascending": false}]
}
```

## Environment Configuration

### .env File

```env
# PostgreSQL Connection
DATABASE_URL=postgres://residentia_user:ResidentiaPass123!@localhost:5432/residentia
JWT_SECRET=residentia-jwt-secret-key-2026

# Legacy Supabase (optional, can be removed)
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_URL=...
```

## File Structure

```
src/
├── integrations/
│   ├── postgres/
│   │   ├── client.server.ts      # Postgres connection pool, JWT helpers
│   │   ├── db.server.ts          # Generic DB request handler
│   │   └── api.server.ts         # API route handlers (/api/auth, /api/db)
│   └── supabase/
│       ├── client.ts             # Postgres-backed Supabase shim
│       └── auth-middleware.ts    # JWT verification middleware
├── server.ts                      # Express-like server entry with API routing
└── routes/                        # App routes using the new Postgres backend

sql/
├── schema.sql                     # Database schema creation
├── seed.sql                       # Sample data for testing
└── init_postgres.sql              # User and database creation
```

## Development Workflow

### 1. Start Development Server

```bash
npm run dev
```

The app will:
- Connect to local PostgreSQL
- Start the Vite dev server
- Make API calls through `/api/db` and `/api/auth/login`
- Use JWT for authentication

### 2. Production Build

```bash
npm run build
```

Creates optimized builds in `dist/client` and `dist/server`.

### 3. Test Database Connection

```bash
# Windows PowerShell
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$env:PGPASSWORD = 'ResidentiaPass123!'
& $psql -U residentia_user -h localhost -p 5432 -d residentia -c "SELECT COUNT(*) FROM public.units;"
```

## Test Credentials

### Admin User
- **Email:** admin@residentia.local
- **Password:** admin@123
- **Role:** admin

### Resident User
- **Email:** resident@residentia.local
- **Password:** resident@123
- **Role:** resident

### Sample Data
- 7 apartment units (A101-B102)
- 6 billing cycles for June 2026
- 2 payment records
- 2 support queries
- 3 announcements
- 1 active waiver

## Security Considerations

### Authentication
- Passwords hashed with bcryptjs (10 salt rounds)
- JWT tokens expire after 7 days
- Bearer tokens required for all API requests

### Database
- Role-based access control (RBAC)
- SQL injection prevented using parameterized queries
- All sensitive operations require JWT verification

### API
- CORS enabled for localhost
- Content-Type validation (application/json)
- Rate limiting recommended for production

## Migration from Supabase

The app maintains the same Supabase JS API surface through a compatibility shim:
- `supabase.auth.signInWithPassword()` → `/api/auth/login`
- `supabase.from(table).select()` → `/api/db` with SELECT operation
- `supabase.from(table).insert()` → `/api/db` with INSERT operation
- All other operations work seamlessly through the unified API

## Troubleshooting

### Connection Errors
- Verify PostgreSQL service is running
- Check DATABASE_URL in .env
- Confirm residentia_user credentials

### Authentication Fails
- Verify JWT_SECRET in .env
- Check if user exists in users table
- Confirm password hash is correct

### API Returns 401
- Ensure token is included in Authorization header
- Verify token hasn't expired
- Check JWT_SECRET matches between client and server

## Next Steps

1. ✅ Database created and populated
2. ✅ API routes established
3. ✅ Authentication working
4. 📋 Additional features:
   - Search and filtering
   - Pagination
   - Real-time updates (optional: WebSockets)
   - Email notifications
   - Audit logging

## Support

For issues or questions:
1. Check PostgreSQL service status
2. Verify .env configuration
3. Review server logs for error details
4. Check database integrity: `SELECT * FROM pg_stat_user_tables;`
