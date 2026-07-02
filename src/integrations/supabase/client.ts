// This file is a Postgres-backed replacement for the original Supabase client.
// It exposes the same minimal API surface used by the app.

type User = {
  id: string;
  email: string | null;
};

type Session = {
  user: User;
  access_token: string;
  expires_at: number | null;
};

type AuthChangeCallback = (event: string, session: Session | null) => void;

type Subscription = {
  unsubscribe: () => void;
};

const AUTH_STORAGE_KEY = "residentia_token";
const AUTH_EVENT = "residentia-auth-state-change";

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1]))));
    return payload;
  } catch {
    return null;
  }
}

function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_STORAGE_KEY);
}

function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, token);
  dispatchAuthEvent("SIGNED_IN", getSessionFromToken(token));
}

function clearStoredToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  dispatchAuthEvent("SIGNED_OUT", null);
}

function dispatchAuthEvent(event: string, session: Session | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { event, session } }));
}

function getSessionFromToken(token: string): Session | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== "object" || !payload.sub) return null;
  return {
    user: {
      id: String(payload.sub),
      email: payload.email ?? null,
    },
    access_token: token,
    expires_at: typeof payload.exp === "number" ? payload.exp * 1000 : null,
  };
}

async function fetchJson(path: string, init: RequestInit = {}) {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(path, { ...init, headers });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    return { error: json?.error ?? { message: response.statusText } };
  }
  return json;
}

class PostgresQueryBuilder {
  private table: string;
  private selectClause = "*";
  private filters: Array<{ type: string; column: string; operator?: string; value: any }> = [];
  private orderItems: Array<{ column: string; ascending?: boolean }> = [];
  private limitCount?: number;
  private singleMode = false;
  private maybeSingleMode = false;
  private operation = "select";
  private payload: any = null;
  private conflictKey?: string;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string) {
    this.selectClause = columns;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  not(column: string, operator: string, value: any) {
    this.filters.push({ type: "not", column, operator, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ type: "in", column, value: values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderItems.push({ column, ascending: options?.ascending });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.maybeSingleMode = true;
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  insert(data: any) {
    this.operation = "insert";
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.operation = "update";
    this.payload = data;
    return this;
  }

  upsert(data: any, options?: { onConflict: string }) {
    this.operation = "upsert";
    this.payload = data;
    this.conflictKey = options?.onConflict;
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  async execute() {
    const body = {
      op: this.operation,
      table: this.table,
      select: this.selectClause,
      filters: this.filters,
      order: this.orderItems,
      limit: this.limitCount,
      data: this.payload,
      conflict: this.conflictKey,
      single: this.singleMode,
      maybeSingle: this.maybeSingleMode,
    };

    const result = await fetchJson("/api/db", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (result?.error) {
      return { data: null, error: { message: result.error.message ?? "Unknown error" } };
    }
    return result;
  }
}

const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const result = await fetchJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (result?.error) {
      return { data: { session: null }, error: { message: result.error.message ?? "Login failed" } };
    }
    if (result?.data?.session?.access_token) {
      setStoredToken(result.data.session.access_token);
    }
    return result;
  },

  async signOut() {
    clearStoredToken();
    return { error: null };
  },

  async getSession() {
    const token = getStoredToken();
    return { data: { session: token ? getSessionFromToken(token) : null } };
  },

  onAuthStateChange(callback: AuthChangeCallback) {
    const listener = (event: Event) => {
      const custom = event as CustomEvent<{ event: string; session: Session | null }>;
      callback(custom.detail.event, custom.detail.session);
    };
    if (typeof window !== "undefined") {
      window.addEventListener(AUTH_EVENT, listener as EventListener);
    }
    return {
      data: {
        subscription: {
          unsubscribe() {
            if (typeof window !== "undefined") {
              window.removeEventListener(AUTH_EVENT, listener as EventListener);
            }
          },
        },
      },
    };
  },
};

export const supabase = {
  auth,
  from(table: string) {
    return new PostgresQueryBuilder(table);
  },
};

export type { Session, User };

