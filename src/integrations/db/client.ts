export interface User {
  id: string;
  email: string;
}

export interface Session {
  access_token: string;
  expires_at: number;
  user: User;
}

// ── Internal state ────────────────────────────────────────────

type AuthChangeCallback = (event: string, session: Session | null) => void;
const authListeners: Set<AuthChangeCallback> = new Set();
let currentSession: Session | null = null;

function notifyAuthListeners(event: string, session: Session | null) {
  currentSession = session;
  for (const cb of authListeners) {
    try {
      cb(event, session);
    } catch {}
  }
}

// ── Token helpers ─────────────────────────────────────────────

const TOKEN_KEY = "residentia_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1];
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function sessionFromToken(token: string): Session | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const exp = payload.exp as number | undefined;
  if (exp && exp * 1000 < Date.now()) return null;
  return {
    access_token: token,
    expires_at: (payload.exp as number) ?? 0,
    user: {
      id: (payload.sub as string) ?? "",
      email: (payload.email as string) ?? "",
    },
  };
}

// ── Auth ──────────────────────────────────────────────────────

async function apiPost(path: string, body: Record<string, unknown>): Promise<any> {
  const token = getToken();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

const auth = {
  async signInWithPassword({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) {
    const json = await apiPost("/api/auth/login", { email, password });
    if (json.error) {
      return { data: { session: null }, error: { message: json.error } };
    }
    const session = json.data?.session;
    if (session?.access_token) {
      setToken(session.access_token);
      notifyAuthListeners("SIGNED_IN", session);
    }
    return { data: { session }, error: null };
  },

  getSession(): Promise<{ data: { session: Session | null } }> {
    if (currentSession) return Promise.resolve({ data: { session: currentSession } });
    const token = getToken();
    if (!token) return Promise.resolve({ data: { session: null } });
    const session = sessionFromToken(token);
    currentSession = session;
    return Promise.resolve({ data: { session } });
  },

  onAuthStateChange(callback: AuthChangeCallback) {
    authListeners.add(callback);
    auth.getSession().then(({ data: { session } }) => {
      setTimeout(() => callback("INITIAL", session), 0);
    });
    return {
      data: {
        subscription: {
          unsubscribe() {
            authListeners.delete(callback);
          },
        },
      },
    };
  },

  async signOut() {
    clearToken();
    currentSession = null;
    notifyAuthListeners("SIGNED_OUT", null);
  },
};

// ── Query Builder ─────────────────────────────────────────────

interface Filter {
  type: string;
  column: string;
  value: unknown;
  op?: string;
}

interface Order {
  column: string;
  ascending?: boolean;
}

interface DbRequest {
  op: string;
  table: string;
  select?: string;
  filters?: Filter[];
  order?: Order[];
  limit?: number;
  data?: unknown;
  single?: boolean;
  maybeSingle?: boolean;
  onConflict?: string;
}

function postDb(req: DbRequest): Promise<{ data: any; error: any }> {
  const token = getToken();
  return fetch("/api/db", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(req),
  })
    .then((res) => {
      if (!res.ok) {
        return res.json().catch(() => ({})).then((j) => ({
          data: null,
          error: { message: j.error || `HTTP ${res.status}` },
        }));
      }
      return res.json();
    })
    .then((json) => {
      if (json.error) return { data: null, error: { message: json.error } };
      return { data: json.data ?? null, error: null };
    })
    .catch((err) => ({ data: null, error: { message: err.message } }));
}

class QueryBuilder {
  private req: DbRequest;
  private _resolved = false;

  constructor(table: string) {
    this.req = { op: "select", table };
  }

  select(cols: string): this {
    this.req.select = cols;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.req.filters = this.req.filters || [];
    this.req.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.req.filters = this.req.filters || [];
    this.req.filters.push({ type: "in", column, value: values });
    return this;
  }

  not(column: string, op: string, value: unknown): this {
    this.req.filters = this.req.filters || [];
    this.req.filters.push({ type: "not", column, value, op });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.req.order = this.req.order || [];
    this.req.order.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(count: number): this {
    this.req.limit = count;
    return this;
  }

  single(): PromiseLike<{ data: any; error: any }> {
    this.req.single = true;
    return this._execute();
  }

  maybeSingle(): PromiseLike<{ data: any; error: any }> {
    this.req.maybeSingle = true;
    return this._execute();
  }

  insert(data: unknown): this {
    this.req.op = "insert";
    this.req.data = data;
    return this;
  }

  update(data: unknown): this {
    this.req.op = "update";
    this.req.data = data;
    return this;
  }

  delete(): this {
    this.req.op = "delete";
    return this;
  }

  upsert(data: unknown, opts?: { onConflict?: string }): this {
    this.req.op = "upsert";
    this.req.data = data;
    if (opts?.onConflict) this.req.onConflict = opts.onConflict;
    return this;
  }

  private _execute(): PromiseLike<{ data: any; error: any }> {
    return postDb(this.req);
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this._execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<{ data: any; error: any } | TResult> {
    return this._execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<{ data: any; error: any }> {
    return this._execute().finally(onfinally);
  }
}

function from(table: string): QueryBuilder {
  return new QueryBuilder(table);
}

export const db = { auth, from };
