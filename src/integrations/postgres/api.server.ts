import {
  pool,
  signToken,
  verifyToken,
  hashPassword,
  verifyPassword,
} from "./client.server";
import { handleDbRequest } from "./db.server";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

function requireAuth(request: Request): { sub: string; email: string; role: string } | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}

async function readBody(request: Request): Promise<any> {
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return {};
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// ── Auth Handlers ─────────────────────────────────────────────

async function handleLogin(request: Request): Promise<Response> {
  const { email, password } = await readBody(request);
  if (!email || !password) {
    return json({ error: "Email and password are required" }, 400);
  }

  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  const user = result.rows[0];

  if (!user) {
    return json({ error: "Invalid email or password" }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return json({ error: "Invalid email or password" }, 401);
  }

  const roleResult = await pool.query("SELECT role FROM user_roles WHERE user_id = $1", [
    user.id,
  ]);
  const role = roleResult.rows[0]?.role || user.role || "resident";

  const token = signToken({ sub: user.id, email: user.email, role });
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

  return json({
    data: {
      session: {
        access_token: token,
        expires_at: expiresAt,
        user: { id: user.id, email: user.email },
      },
    },
  });
}

async function handleListUsers(request: Request): Promise<Response> {
  const user = requireAuth(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { role } = await readBody(request);
  let sql = `
    SELECT u.id, u.email, u.created_at, ur.role
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
  `;
  const params: any[] = [];
  if (role) {
    params.push(role);
    sql += ` WHERE ur.role = $1`;
  }
  sql += " ORDER BY u.created_at DESC";

  const result = await pool.query(sql, params);
  return json({ data: result.rows });
}

async function handleCreateUser(request: Request): Promise<Response> {
  const user = requireAuth(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await readBody(request);
  const { email, password, name, role = "owner" } = body;
  if (!email || !password) {
    return json({ error: "Email and password are required" }, 400);
  }

  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email",
    [email, passwordHash, role],
  );
  const newUser = result.rows[0];

  await pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [
    newUser.id,
    role,
  ]);

  if (name) {
    await pool.query(
      "INSERT INTO profiles (id, full_name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET full_name = $2",
      [newUser.id, name, email],
    );
  }

  return json({ data: newUser });
}

async function handleUpdateUser(request: Request): Promise<Response> {
  const user = requireAuth(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await readBody(request);
  const { user_id, email, name } = body;
  if (!user_id) return json({ error: "user_id is required" }, 400);

  if (email) {
    await pool.query("UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2", [
      email,
      user_id,
    ]);
  }
  if (name) {
    await pool.query(
      "UPDATE profiles SET full_name = $1 WHERE id = $2",
      [name, user_id],
    );
  }

  return json({ data: { ok: true } });
}

async function handleDeleteUser(request: Request): Promise<Response> {
  const user = requireAuth(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { user_id } = await readBody(request);
  if (!user_id) return json({ error: "user_id is required" }, 400);

  await pool.query("DELETE FROM users WHERE id = $1", [user_id]);
  return json({ data: { ok: true } });
}

async function handleCreateTenant(request: Request): Promise<Response> {
  const user = requireAuth(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await readBody(request);
  const { name, phone, email, password, unit_id } = body;
  if (!name || !unit_id) {
    return json({ error: "name and unit_id are required" }, 400);
  }

  let userId: string | null = null;

  if (email && password) {
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'resident') RETURNING id",
      [email, passwordHash],
    );
    userId = result.rows[0].id;

    await pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'resident')", [
      userId,
    ]);

    await pool.query(
      "INSERT INTO profiles (id, full_name, email, phone, unit_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET full_name = $2, unit_id = $5",
      [userId, name, email, phone || null, unit_id],
    );
  }

  await pool.query("UPDATE units SET owner_name = $1, owner_phone = $2 WHERE id = $3", [
    name,
    phone || null,
    unit_id,
  ]);

  return json({ data: { id: userId, unit_id } });
}

async function handleDeleteTenant(request: Request): Promise<Response> {
  const user = requireAuth(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { unit_id } = await readBody(request);
  if (!unit_id) return json({ error: "unit_id is required" }, 400);

  const unitResult = await pool.query(
    "SELECT owner_user_id FROM units WHERE id = $1",
    [unit_id],
  );
  const unit = unitResult.rows[0];

  if (unit?.owner_user_id) {
    await pool.query("DELETE FROM profiles WHERE id = $1", [unit.owner_user_id]);
    await pool.query("DELETE FROM user_roles WHERE user_id = $1", [unit.owner_user_id]);
    await pool.query("DELETE FROM users WHERE id = $1", [unit.owner_user_id]);
  }

  await pool.query(
    "UPDATE units SET owner_name = NULL, owner_phone = NULL, owner_user_id = NULL WHERE id = $1",
    [unit_id],
  );

  return json({ data: { ok: true } });
}

// ── Payment Handlers ──────────────────────────────────────────

async function handleRazorpayKey(_request: Request): Promise<Response> {
  const key = process.env.RAZORPAY_KEY_ID || "";
  return json({ key });
}

async function handleCreateOrder(request: Request): Promise<Response> {
  const user = requireAuth(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await readBody(request);
  const { amount, unit_id, billing_cycle_id, month, year } = body;

  try {
    const Razorpay = (await import("razorpay")).default;
    const rz = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "",
    });

    const order = await rz.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      receipt: `${unit_id}_${billing_cycle_id}_${month}_${year}`,
    });

    return json({ data: order });
  } catch (err: any) {
    console.error("[razorpay]", err.message);
    return json({ error: err.message || "Payment gateway error" }, 500);
  }
}

async function handleVerifyPayment(request: Request): Promise<Response> {
  const user = requireAuth(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await readBody(request);
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    billing_cycle_id,
    unit_id,
    amount,
    month,
    year,
  } = body;

  try {
    const crypto = await import("crypto");
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return json({ error: "Invalid payment signature" }, 400);
    }

    let cycleId = billing_cycle_id;
    if (!cycleId && unit_id && month && year) {
      const cycleResult = await pool.query(
        "INSERT INTO billing_cycles (unit_id, month, year, total_due, is_waiver_period) VALUES ($1, $2, $3, $4, false) ON CONFLICT (unit_id, month, year) DO UPDATE SET unit_id = EXCLUDED.unit_id RETURNING id",
        [unit_id, month, year, amount],
      );
      cycleId = cycleResult.rows[0].id;
    }

    await pool.query(
      `INSERT INTO payments (unit_id, billing_cycle_id, total_paid, balance, status, payment_mode, razorpay_order_id, razorpay_payment_id, recorded_by)
       VALUES ($1, $2, $3, 0, 'PENDING VERIFICATION', 'razorpay', $4, $5, $6)`,
      [unit_id, cycleId, amount, razorpay_order_id, razorpay_payment_id, user.email],
    );

    return json({ data: { verified: true } });
  } catch (err: any) {
    console.error("[verify]", err.message);
    return json({ error: err.message || "Verification failed" }, 500);
  }
}

// ── Ensure Tables ─────────────────────────────────────────────

let tablesEnsured = false;

async function ensureTables() {
  if (tablesEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
        type VARCHAR(50),
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
    `);

    await pool.query(`
      ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
      ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
      ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    `);

    await pool.query(`
      ALTER TABLE public.queries ADD COLUMN IF NOT EXISTS message TEXT;
    `);

    tablesEnsured = true;
  } catch (err: any) {
    console.error("[ensureTables]", err.message);
  }
}

// ── Router ────────────────────────────────────────────────────

export async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith("/api/")) return null;

  await ensureTables();

  try {
    if (path === "/api/auth/login") return handleLogin(request);
    if (path === "/api/auth/list-users") return handleListUsers(request);
    if (path === "/api/auth/create-user") return handleCreateUser(request);
    if (path === "/api/auth/update-user") return handleUpdateUser(request);
    if (path === "/api/auth/delete-user") return handleDeleteUser(request);
    if (path === "/api/auth/create-tenant") return handleCreateTenant(request);
    if (path === "/api/auth/delete-tenant") return handleDeleteTenant(request);
    if (path === "/api/payments/razorpay-key") return handleRazorpayKey(request);
    if (path === "/api/payments/create-order") return handleCreateOrder(request);
    if (path === "/api/payments/verify") return handleVerifyPayment(request);

    if (path === "/api/db") {
      const body = await readBody(request);
      const result = await handleDbRequest(body);
      if (result.error) return json({ error: result.error }, 400);
      return json({ data: result.data });
    }

    return null;
  } catch (err: any) {
    console.error("[api]", path, err.message);
    return json({ error: err.message || "Internal server error" }, 500);
  }
}
