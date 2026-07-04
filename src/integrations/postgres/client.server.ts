import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL environment variable.");
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("Missing JWT_SECRET environment variable.");
}

export const pgPool = new Pool({ connectionString });

export type DbUser = {
  id: string;
  email: string;
  role: string | null;
  password_hash?: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createJwt(payload: { sub: string; email: string; role: string | null }) {
  return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
}

export function verifyJwt(token: string) {
  return jwt.verify(token, jwtSecret) as {
    sub: string;
    email: string;
    role: string | null;
    exp: number;
    iat: number;
  };
}

export async function getUserByEmail(email: string) {
  const result = await pgPool.query<DbUser & { password_hash: string }>(
    `SELECT id, email, role, password_hash FROM public.users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()],
  );
  return result.rows[0];
}

export async function getUserById(id: string) {
  const result = await pgPool.query<DbUser>(
    `SELECT id, email, role FROM public.users WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0];
}
