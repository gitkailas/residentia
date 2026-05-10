import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Building2, Receipt, BookOpenCheck, LogOut, Menu, X,
  CalendarPlus, BadgePercent, AlertTriangle, Megaphone, MessageCircle,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/units", label: "Units & Tenants", icon: Building2 },
  { to: "/admin/billing", label: "Billing Generator", icon: CalendarPlus },
  { to: "/admin/payments", label: "Payment Entry", icon: Receipt },
  { to: "/admin/ledger", label: "Ledger", icon: BookOpenCheck },
  { to: "/admin/waivers", label: "Waivers", icon: BadgePercent },
  { to: "/admin/defaulters", label: "Defaulters", icon: AlertTriangle },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/queries", label: "Queries", icon: MessageCircle },
];

function AdminLayout() {
  const { session, role, loading, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  useEffect(() => {
    if (loading) return;
    if (!session) nav({ to: "/login" });
    else if (role && role !== "admin") nav({ to: "/resident/home" });
  }, [loading, session, role, nav]);

  if (loading || !session || role !== "admin") {
    return <div className="flex min-h-screen items-center justify-center"><Brand /></div>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2 text-sidebar-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-gold-foreground font-bold">R</div>
            <div className="leading-tight">
              <div className="text-sm font-bold">Residentia</div>
              <div className="text-[10px] uppercase tracking-wider opacity-80">Admin</div>
            </div>
          </div>
          <button className="md:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>

        <nav className="space-y-1 p-3">
          {NAV.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-gold text-gold-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-sidebar-border p-3">
          <button
            onClick={async () => { await signOut(); nav({ to: "/login" }); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col md:ml-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
          <button className="md:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="hidden md:block" />
          <div className="text-xs text-muted-foreground">
            {session.user.email}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
