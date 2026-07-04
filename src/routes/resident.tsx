import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Brand } from "@/components/Brand";
import { cn } from "@/lib/utils";
import { Home, Receipt, Upload, MessageSquare, User, LogOut } from "lucide-react";

export const Route = createFileRoute("/resident")({
  component: ResidentLayout,
});

const TABS = [
  { to: "/resident/home", label: "Home", icon: Home },
  { to: "/resident/payments", label: "Payments", icon: Receipt },
  { to: "/resident/submit", label: "Submit", icon: Upload },
  { to: "/resident/queries", label: "Queries", icon: MessageSquare },
  { to: "/resident/profile", label: "Profile", icon: User },
];

function ResidentLayout() {
  const { session, role, loading, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!session) nav({ to: "/login" });
    else if (role === "master_admin" || role === "owner") nav({ to: "/admin/dashboard" });
  }, [loading, session, role, nav]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Brand />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="sticky top-0 z-30 border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-gold-foreground font-bold">
              R
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold">Residentia</div>
              <div className="text-[10px] uppercase tracking-wider opacity-80">
                RWA Malabar Red Orchids
              </div>
            </div>
          </div>
          <button
            aria-label="Sign out"
            onClick={async () => {
              await signOut();
              nav({ to: "/login" });
            }}
            className="rounded-md p-2 hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card shadow-[0_-4px_12px_rgb(0_0_0_/_0.04)]">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {TABS.map((t) => {
            const active = loc.pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
