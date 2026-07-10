import {
  createJwt,
  getUserByEmail,
  verifyPassword,
  hashPassword,
  pgPool,
  verifyJwt,
} from "./client.server";
import { handleDbRequest } from "./db.server";

export async function handleApiRequest(request: Request) {
  const url = new URL(request.url);
  console.log(`[API] ${request.method} ${url.pathname}`);

  if (url.pathname === "/api/auth/login") {
    return handleAuthLogin(request);
  }
  if (url.pathname === "/api/auth/create-user") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }
    return handleCreateUser(request);
  }
  if (url.pathname === "/api/auth/list-users") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }
    return handleListUsers(request);
  }
  if (url.pathname === "/api/auth/create-tenant") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }
    return handleCreateTenant(request);
  }
  if (url.pathname === "/api/auth/delete-tenant") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }
    return handleDeleteTenant(request);
  }
  if (url.pathname === "/api/auth/update-user") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }
    return handleUpdateUser(request);
  }
  if (url.pathname === "/api/auth/delete-user") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }
    return handleDeleteUser(request);
  }
  if (url.pathname === "/api/db") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }
    return handleDbRequest(request);
  }
  return null;
}

async function handleAuthLogin(request: Request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    console.error("[AUTH] Invalid request body:", body);
    return new Response(JSON.stringify({ error: { message: "Invalid request body" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { email, password } = body as { email?: string; password?: string };
  if (!email || !password) {
    console.error("[AUTH] Missing email or password");
    return new Response(JSON.stringify({ error: { message: "Email and password are required" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  console.log(`[AUTH] Login attempt for email: ${email}`);
  const user = await getUserByEmail(email);
  if (!user) {
    console.error(`[AUTH] User not found: ${email}`);
    return new Response(JSON.stringify({ error: { message: "Invalid email or password" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  if (!user.password_hash) {
    console.error(`[AUTH] No password hash for user: ${email}`);
    return new Response(JSON.stringify({ error: { message: "Invalid email or password" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  console.log(`[AUTH] Verifying password for user: ${user.email}`);
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    console.error(`[AUTH] Invalid password for user: ${email}`);
    return new Response(JSON.stringify({ error: { message: "Invalid email or password" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const token = createJwt({ sub: user.id, email: user.email, role: user.role });
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

  return new Response(
    JSON.stringify({
      data: {
        session: {
          access_token: token,
          expires_at: expiresAt,
          user: {
            id: user.id,
            email: user.email,
          },
        },
      },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

function getTokenClaims(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return verifyJwt(authHeader.replace("Bearer ", ""));
  } catch {
    return null;
  }
}

async function handleCreateUser(request: Request) {
  const claims = getTokenClaims(request);
  if (!claims || claims.role !== "master_admin") {
    return new Response(JSON.stringify({ error: { message: "Forbidden" } }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: { message: "Invalid request body" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const {
    email,
    password,
    name,
    role = "owner",
  } = body as { email?: string; password?: string; name?: string; role?: string };
  if (!email || !password) {
    return new Response(JSON.stringify({ error: { message: "Email and password are required" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const allowedRoles = ["owner", "resident"];
  if (!allowedRoles.includes(role)) {
    return new Response(
      JSON.stringify({ error: { message: `Role must be one of: ${allowedRoles.join(", ")}` } }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return new Response(
      JSON.stringify({ error: { message: "A user with this email already exists" } }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  }

  const passwordHash = await hashPassword(password);

  let client;
  try {
    client = await pgPool.connect();
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO public.users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role`,
      [email.toLowerCase(), passwordHash, role],
    );
    const user = userResult.rows[0];

    await client.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)`, [
      user.id,
      role,
    ]);

    if (name) {
      try {
        await client.query(
          `INSERT INTO public.profiles (id, full_name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET full_name = $2`,
          [user.id, name, user.email],
        );
      } catch {
        // profiles table may not exist locally — skip silently
      }
    }

    await client.query("COMMIT");

    return new Response(
      JSON.stringify({ data: { id: user.id, email: user.email, role: user.role } }),
      {
        status: 201,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-USER] Error:", msg);
    return new Response(JSON.stringify({ error: { message: `Failed to create user: ${msg}` } }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } finally {
    if (client) {
      try {
        client.release();
      } catch {}
    }
  }
}

async function handleUpdateUser(request: Request) {
  const claims = getTokenClaims(request);
  if (!claims || claims.role !== "master_admin") {
    return new Response(JSON.stringify({ error: { message: "Forbidden" } }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: { message: "Invalid request body" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { user_id, name, email } = body as { user_id?: string; name?: string; email?: string };
  if (!user_id) {
    return new Response(JSON.stringify({ error: { message: "user_id is required" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let client;
  try {
    client = await pgPool.connect();
    await client.query("BEGIN");

    if (email !== undefined) {
      const exists = await client.query(
        `SELECT id FROM public.users WHERE email = $1 AND id != $2`,
        [email.toLowerCase(), user_id],
      );
      if (exists.rows.length > 0) {
        await client.query("ROLLBACK");
        return new Response(
          JSON.stringify({ error: { message: "Email already in use by another account" } }),
          { status: 409, headers: { "content-type": "application/json" } },
        );
      }
      await client.query(`UPDATE public.users SET email = $1 WHERE id = $2`, [
        email.toLowerCase(),
        user_id,
      ]);
    }

    if (name !== undefined) {
      await client.query(
        `INSERT INTO public.profiles (id, full_name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET full_name = $2`,
        [user_id, name || null],
      );
    }

    await client.query("COMMIT");

    return new Response(JSON.stringify({ data: { success: true } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[UPDATE-USER] Error:", msg);
    return new Response(JSON.stringify({ error: { message: `Failed to update user: ${msg}` } }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } finally {
    if (client) {
      try {
        client.release();
      } catch {}
    }
  }
}

async function handleDeleteUser(request: Request) {
  const claims = getTokenClaims(request);
  if (!claims || claims.role !== "master_admin") {
    return new Response(JSON.stringify({ error: { message: "Forbidden" } }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: { message: "Invalid request body" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { user_id } = body as { user_id?: string };
  if (!user_id) {
    return new Response(JSON.stringify({ error: { message: "user_id is required" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let client;
  try {
    client = await pgPool.connect();
    await client.query("BEGIN");

    // Check if the owner has any units assigned
    const unitResult = await client.query(
      `SELECT COUNT(*)::int AS count FROM public.units WHERE owner_user_id = $1`,
      [user_id],
    );
    if (unitResult.rows[0].count > 0) {
      await client.query("ROLLBACK");
      return new Response(
        JSON.stringify({
          error: { message: "Owner account contains data. Delete all properties first." },
        }),
        { status: 409, headers: { "content-type": "application/json" } },
      );
    }

    await client.query(`DELETE FROM public.users WHERE id = $1`, [user_id]);

    await client.query("COMMIT");

    return new Response(JSON.stringify({ data: { success: true } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[DELETE-USER] Error:", msg);
    return new Response(JSON.stringify({ error: { message: `Failed to delete user: ${msg}` } }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } finally {
    if (client) {
      try {
        client.release();
      } catch {}
    }
  }
}

async function handleCreateTenant(request: Request) {
  try {
    const claims = getTokenClaims(request);
    if (!claims || (claims.role !== "master_admin" && claims.role !== "owner")) {
      return new Response(JSON.stringify({ error: { message: "Forbidden" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: { message: "Invalid request body" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const {
      email,
      password,
      name,
      phone,
      unit_id,
      registration_date,
      key_handover_date,
      billing_enabled,
    } = body as {
      email?: string;
      password?: string;
      name?: string;
      phone?: string;
      unit_id?: string;
      registration_date?: string | null;
      key_handover_date?: string | null;
      billing_enabled?: boolean;
    };

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: { message: "Email and password are required" } }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    if (!unit_id) {
      return new Response(JSON.stringify({ error: { message: "Unit ID is required" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Check for existing user with same email
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: { message: "A user with this email already exists" } }),
        { status: 409, headers: { "content-type": "application/json" } },
      );
    }

    // Check for existing phone in units table (excluding the unit being assigned)
    if (phone) {
      const existingPhone = await pgPool.query(
        `SELECT id FROM public.units WHERE owner_phone = $1 AND ($2::text IS NULL OR id::text != $2)`,
        [phone.trim(), unit_id || null],
      );
      if (existingPhone.rows.length > 0) {
        return new Response(
          JSON.stringify({
            error: { message: "This mobile number is already assigned to another tenant" },
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        );
      }
    }

    // Check for existing phone in profiles table (has a UNIQUE constraint)
    if (phone) {
      const existingProfile = await pgPool.query(
        `SELECT id FROM public.profiles WHERE phone = $1`,
        [phone.trim()],
      );
      if (existingProfile.rows.length > 0) {
        return new Response(
          JSON.stringify({
            error: { message: "This mobile number is already assigned to another tenant" },
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        );
      }
    }

    if (claims.role === "owner" && unit_id) {
      const unitResult = await pgPool.query(
        `SELECT id, owner_user_id FROM public.units WHERE id = $1`,
        [unit_id],
      );
      if (unitResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: { message: "Unit not found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      if (unitResult.rows[0].owner_user_id !== claims.sub) {
        return new Response(
          JSON.stringify({ error: { message: "Forbidden: you do not own this unit" } }),
          { status: 403, headers: { "content-type": "application/json" } },
        );
      }
    }

    const passwordHash = await hashPassword(password);

    // NOTE: pgPool.connect() must be inside try/catch so connection errors
    // are returned as JSON, not propagated as uncaught exceptions.
    let client;
    try {
      client = await pgPool.connect();
      await client.query("BEGIN");

      const userResult = await client.query(
        `INSERT INTO public.users (email, password_hash, role) VALUES ($1, $2, 'resident') RETURNING id, email, role`,
        [email.toLowerCase(), passwordHash],
      );
      const user = userResult.rows[0];

      await client.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'resident')`, [
        user.id,
      ]);

      await client.query(
        `INSERT INTO public.profiles (id, full_name, email, phone, unit_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET full_name = $2, phone = $4, unit_id = $5`,
        [user.id, name || null, user.email, phone || null, unit_id || null],
      );

      const computedBilling = billing_enabled ?? (key_handover_date ? true : false);

      await client.query(
        `UPDATE public.units SET owner_name = $1, owner_phone = $2, status = 'sold', registration_date = COALESCE($3, registration_date), key_handover_date = COALESCE($4, key_handover_date), billing_enabled = $5 WHERE id = $6`,
        [
          name || null,
          phone || null,
          registration_date || null,
          key_handover_date || null,
          computedBilling,
          unit_id || null,
        ],
      );

      await client.query("COMMIT");

      return new Response(JSON.stringify({ data: { id: user.id, email: user.email } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch {}
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[CREATE-TENANT] Error:", msg);
      return new Response(
        JSON.stringify({ error: { message: `Failed to create tenant: ${msg}` } }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    } finally {
      if (client) {
        try {
          client.release();
        } catch {}
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-TENANT] Unhandled error:", msg);
    return new Response(JSON.stringify({ error: { message: `Failed to create tenant: ${msg}` } }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

async function handleDeleteTenant(request: Request) {
  const claims = getTokenClaims(request);
  if (!claims || (claims.role !== "master_admin" && claims.role !== "owner")) {
    return new Response(JSON.stringify({ error: { message: "Forbidden" } }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: { message: "Invalid request body" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { unit_id } = body as { unit_id?: string };
  if (!unit_id) {
    return new Response(JSON.stringify({ error: { message: "unit_id is required" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let client;
  try {
    client = await pgPool.connect();
    await client.query("BEGIN");

    // If owner, verify they own the unit
    if (claims.role === "owner") {
      const unitResult = await client.query(
        `SELECT id, owner_user_id FROM public.units WHERE id = $1`,
        [unit_id],
      );
      if (unitResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return new Response(JSON.stringify({ error: { message: "Unit not found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      if (unitResult.rows[0].owner_user_id !== claims.sub) {
        await client.query("ROLLBACK");
        return new Response(
          JSON.stringify({ error: { message: "Forbidden: you do not own this unit" } }),
          { status: 403, headers: { "content-type": "application/json" } },
        );
      }
    }

    // Find the tenant user linked to this unit via profiles
    const profileResult = await client.query(
      `SELECT id FROM public.profiles WHERE unit_id = $1 LIMIT 1`,
      [unit_id],
    );

    const tenantUserId = profileResult.rows.length > 0 ? profileResult.rows[0].id : null;

    // Clear tenant info from unit and reset status to vacant
    await client.query(
      `UPDATE public.units SET owner_name = NULL, owner_phone = NULL, status = 'vacant', registration_date = NULL, key_handover_date = NULL, waiver_start_date = NULL, waiver_end_date = NULL, billing_enabled = false WHERE id = $1`,
      [unit_id],
    );

    // Delete the tenant user if one exists (cascades to profiles, user_roles)
    if (tenantUserId) {
      await client.query(`DELETE FROM public.users WHERE id = $1`, [tenantUserId]);
    }

    await client.query("COMMIT");

    return new Response(JSON.stringify({ data: { success: true } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[DELETE-TENANT] Error:", msg);
    return new Response(JSON.stringify({ error: { message: `Failed to delete tenant: ${msg}` } }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } finally {
    if (client) {
      try {
        client.release();
      } catch {}
    }
  }
}

async function handleListUsers(request: Request) {
  const claims = getTokenClaims(request);
  if (!claims || claims.role !== "master_admin") {
    return new Response(JSON.stringify({ error: { message: "Forbidden" } }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const { role: filterRole = "owner" } = body as { role?: string };

  try {
    // profiles table may not exist locally — check before joining
    const hasProfiles = await pgPool.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles')`,
    );
    const useProfiles = hasProfiles.rows[0]?.exists ?? false;

    const sql = useProfiles
      ? `SELECT u.id, u.email, u.role, u.created_at, p.full_name
         FROM public.users u
         LEFT JOIN public.profiles p ON p.id = u.id
         WHERE u.id IN (SELECT user_id FROM public.user_roles WHERE role = $1)
         ORDER BY u.created_at DESC`
      : `SELECT u.id, u.email, u.role, u.created_at, NULL::text AS full_name
         FROM public.users u
         WHERE u.id IN (SELECT user_id FROM public.user_roles WHERE role = $1)
         ORDER BY u.created_at DESC`;

    const result = await pgPool.query(sql, [filterRole]);

    return new Response(JSON.stringify({ data: result.rows }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[LIST-USERS] Error:", msg);
    return new Response(JSON.stringify({ error: { message: `Failed to list users: ${msg}` } }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
