import { createJwt, getUserByEmail, verifyPassword } from "./client.server";
import { handleDbRequest } from "./db.server";

export async function handleApiRequest(request: Request) {
  const url = new URL(request.url);
  console.log(`[API] ${request.method} ${url.pathname}`);
  
  if (url.pathname === "/api/auth/login") {
    return handleAuthLogin(request);
  }
  if (url.pathname === "/api/db") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), { status: 405, headers: { "content-type": "application/json" } });
    }
    return handleDbRequest(request);
  }
  return null;
}

async function handleAuthLogin(request: Request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), { status: 405, headers: { "content-type": "application/json" } });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    console.error("[AUTH] Invalid request body:", body);
    return new Response(JSON.stringify({ error: { message: "Invalid request body" } }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const { email, password } = body as { email?: string; password?: string };
  if (!email || !password) {
    console.error("[AUTH] Missing email or password");
    return new Response(JSON.stringify({ error: { message: "Email and password are required" } }), { status: 400, headers: { "content-type": "application/json" } });
  }

  console.log(`[AUTH] Login attempt for email: ${email}`);
  const user = await getUserByEmail(email);
  if (!user) {
    console.error(`[AUTH] User not found: ${email}`);
    return new Response(JSON.stringify({ error: { message: "Invalid email or password" } }), { status: 401, headers: { "content-type": "application/json" } });
  }
  
  if (!user.password_hash) {
    console.error(`[AUTH] No password hash for user: ${email}`);
    return new Response(JSON.stringify({ error: { message: "Invalid email or password" } }), { status: 401, headers: { "content-type": "application/json" } });
  }

  console.log(`[AUTH] Verifying password for user: ${user.email}`);
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    console.error(`[AUTH] Invalid password for user: ${email}`);
    return new Response(JSON.stringify({ error: { message: "Invalid email or password" } }), { status: 401, headers: { "content-type": "application/json" } });
  }

  const token = createJwt({ sub: user.id, email: user.email, role: user.role });
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

  return new Response(JSON.stringify({
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
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
