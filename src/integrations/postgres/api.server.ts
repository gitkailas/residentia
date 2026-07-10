import {
  createJwt,
  getUserByEmail,
  verifyPassword,
  hashPassword,
  pgPool,
  verifyJwt,
} from "./client.server";
import { handleDbRequest } from "./db.server";
import Razorpay from "razorpay";

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
  if (url.pathname === "/api/payments/create-order") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }
    return handleCreateRazorpayOrder(request);
  }
  if (url.pathname === "/api/payments/verify") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }
    return handleVerifyRazorpayPayment(request);
  }
  if (url.pathname === "/api/payments/razorpay-webhook") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }
    return handleRazorpayWebhook(request);
  }
  if (url.pathname === "/api/payments/razorpay-key") {
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }
    return handleGetRazorpayKey();
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

// ---------------------------------------------------------------------------
// Razorpay helpers
// ---------------------------------------------------------------------------

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function handleGetRazorpayKey() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) return json({ configured: false });
  return json({ configured: true, key_id: keyId });
}

async function handleCreateRazorpayOrder(request: Request) {
  const claims = getTokenClaims(request);
  if (!claims) return json({ error: { message: "Unauthorized" } }, 401);

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    return json({ error: { message: "Razorpay is not configured" } }, 503);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ error: { message: "Invalid request body" } }, 400);
  }

  const { unit_id, billing_cycle_id, amount, month, year, maintenance, garbage, rent } = body as {
    unit_id?: string;
    billing_cycle_id?: string;
    amount?: number;
    month?: string;
    year?: number;
    maintenance?: number;
    garbage?: number;
    rent?: number;
  };

  if (!unit_id || !amount || amount <= 0) {
    return json({ error: { message: "unit_id and a positive amount are required" } }, 400);
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      receipt: `${unit_id.slice(0, 8)}-${month}-${year}`,
      notes: {
        unit_id,
        billing_cycle_id: billing_cycle_id || "",
        month: month || "",
        year: String(year || ""),
        maintenance: String(maintenance || 0),
        garbage: String(garbage || 0),
        rent: String(rent || 0),
      },
    });

    return json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[RAZORPAY] create-order error:", msg);
    return json({ error: { message: `Failed to create order: ${msg}` } }, 500);
  }
}

async function handleVerifyRazorpayPayment(request: Request) {
  const claims = getTokenClaims(request);
  if (!claims) return json({ error: { message: "Unauthorized" } }, 401);

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return json({ error: { message: "Razorpay is not configured" } }, 503);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ error: { message: "Invalid request body" } }, 400);
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    unit_id,
    billing_cycle_id,
    maintenance,
    garbage,
    rent,
    total,
    month,
    year,
  } = body as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    unit_id?: string;
    billing_cycle_id?: string;
    maintenance?: number;
    garbage?: number;
    rent?: number;
    total?: number;
    month?: string;
    year?: number;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ error: { message: "Missing Razorpay payment details" } }, 400);
  }

  // Verify signature
  const crypto = await import("crypto");
  const expectedSig = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSig !== razorpay_signature) {
    console.error("[RAZORPAY] Signature mismatch for order", razorpay_order_id);
    return json({ error: { message: "Payment signature verification failed" } }, 400);
  }

  // Create payment record
  try {
    // Ensure billing cycle exists
    let cycleId = billing_cycle_id || null;
    if (!cycleId && unit_id && month && year) {
      const existing = await pgPool.query(
        `SELECT id FROM public.billing_cycles WHERE unit_id = $1 AND month = $2 AND year = $3`,
        [unit_id, month, year],
      );
      if (existing.rows.length > 0) {
        cycleId = existing.rows[0].id;
      } else {
        const created = await pgPool.query(
          `INSERT INTO public.billing_cycles (unit_id, month, year, maintenance_due, garbage_due, rent_due, total_due, is_waiver_period)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING id`,
          [unit_id, month, year, maintenance || 0, garbage || 0, rent || 0, total || 0],
        );
        cycleId = created.rows[0].id;
      }
    }

    const paidAmount = total || 0;
    const dueAmount = paidAmount; // For Razorpay, the full order amount is paid

    const result = await pgPool.query(
      `INSERT INTO public.payments
        (unit_id, billing_cycle_id, amount_maintenance, amount_garbage, total_paid, balance, payment_date, payment_mode, status, razorpay_order_id, razorpay_payment_id, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, 'UPI', 'PENDING VERIFICATION', $7, $8, $9)
       RETURNING id`,
      [
        unit_id,
        cycleId,
        maintenance || 0,
        garbage || 0,
        paidAmount,
        0,
        razorpay_order_id,
        razorpay_payment_id,
        claims.email || claims.sub,
      ],
    );

    return json({ success: true, payment_id: result.rows[0].id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[RAZORPAY] verify error:", msg);
    return json({ error: { message: `Failed to verify payment: ${msg}` } }, 500);
  }
}

async function handleRazorpayWebhook(request: Request) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return json({ error: { message: "Razorpay is not configured" } }, 503);
  }

  // Read raw body for signature verification
  const rawBody = await request.text();

  // Verify webhook signature
  const razorpaySignature = request.headers.get("x-razorpay-signature");
  if (!razorpaySignature) {
    return json({ error: { message: "Missing webhook signature" } }, 400);
  }

  const crypto = await import("crypto");
  const expectedSig = crypto.createHmac("sha256", keySecret).update(rawBody).digest("hex");

  if (expectedSig !== razorpaySignature) {
    console.error("[RAZORPAY] Webhook signature mismatch");
    return json({ error: { message: "Invalid webhook signature" } }, 400);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: { message: "Invalid JSON" } }, 400);
  }

  const event = payload?.event;
  if (event !== "payment.captured") {
    // Acknowledge other events without processing
    return json({ status: "ignored" });
  }

  const paymentEntity = payload?.payload?.payment?.entity;
  if (!paymentEntity) {
    return json({ error: { message: "Missing payment entity" } }, 400);
  }

  const {
    id: rpPaymentId,
    order_id: rpOrderId,
    amount,
    method,
    notes,
  } = paymentEntity as {
    id: string;
    order_id: string;
    amount: number;
    method: string;
    notes: Record<string, string>;
  };

  const unitId = notes?.unit_id;
  const billingCycleId = notes?.billing_cycle_id || null;
  const month = notes?.month;
  const year = notes?.year ? parseInt(notes.year) : null;
  const maintenance = notes?.maintenance ? parseFloat(notes.maintenance) : 0;
  const garbage = notes?.garbage ? parseFloat(notes.garbage) : 0;
  const rent = notes?.rent ? parseFloat(notes.rent) : 0;

  if (!unitId) {
    console.error("[RAZORPAY] Webhook missing unit_id in notes");
    return json({ error: { message: "Missing unit_id in order notes" } }, 400);
  }

  try {
    // Check for duplicate webhook
    const existing = await pgPool.query(
      `SELECT id FROM public.payments WHERE razorpay_payment_id = $1`,
      [rpPaymentId],
    );
    if (existing.rows.length > 0) {
      console.log("[RAZORPAY] Webhook duplicate — payment already recorded:", rpPaymentId);
      return json({ status: "already_processed" });
    }

    // Ensure billing cycle exists
    let cycleId = billingCycleId || null;
    if (!cycleId && month && year) {
      const cycleResult = await pgPool.query(
        `SELECT id FROM public.billing_cycles WHERE unit_id = $1 AND month = $2 AND year = $3`,
        [unitId, month, year],
      );
      if (cycleResult.rows.length > 0) {
        cycleId = cycleResult.rows[0].id;
      } else if (month && year) {
        const created = await pgPool.query(
          `INSERT INTO public.billing_cycles (unit_id, month, year, maintenance_due, garbage_due, rent_due, total_due, is_waiver_period)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING id`,
          [unitId, month, year, maintenance, garbage, rent, amount / 100],
        );
        cycleId = created.rows[0].id;
      }
    }

    const paidAmount = amount / 100; // Convert from paise

    await pgPool.query(
      `INSERT INTO public.payments
        (unit_id, billing_cycle_id, amount_maintenance, amount_garbage, total_paid, balance, payment_date, payment_mode, status, razorpay_order_id, razorpay_payment_id, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, 'PENDING VERIFICATION', $8, $9, 'razorpay-webhook')
       ON CONFLICT DO NOTHING`,
      [
        unitId,
        cycleId,
        maintenance,
        garbage,
        paidAmount,
        0,
        method || "upi",
        rpOrderId,
        rpPaymentId,
      ],
    );

    console.log("[RAZORPAY] Webhook payment recorded:", rpPaymentId);
    return json({ status: "processed" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[RAZORPAY] Webhook error:", msg);
    return json({ error: { message: `Webhook processing failed: ${msg}` } }, 500);
  }
}
