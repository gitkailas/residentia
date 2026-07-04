import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@/integrations/db/client";
import { db } from "@/integrations/db/client";

type Role = "master_admin" | "owner" | "resident" | null;

interface AuthCtx {
  session: Session | null;
  user: User | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        // Defer role fetch to avoid deadlocks
        setTimeout(() => fetchRole(s.user.id), 0);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    db.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) fetchRole(s.user.id);
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchRole(uid: string) {
    const { data } = await db.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    setRole((data?.role as Role) ?? "resident");
    setLoading(false);
  }

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        loading,
        signOut: async () => {
          await db.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
