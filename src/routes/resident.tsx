import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/integrations/db/client";
import { Brand } from "@/components/Brand";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Home, Receipt, Upload, MessageSquare, User, LogOut, Bell, ShieldX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const { session, role, loading, signOut, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["resident-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await db
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .eq("read", false)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  async function markNotificationsRead() {
    if (notifications.length === 0) return;
    const ids = notifications.map((n: any) => n.id);
    await db.from("notifications").update({ read: true }).in("id", ids);
    qc.invalidateQueries({ queryKey: ["resident-notifications", user?.id] });
  }

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
          <div className="flex items-center gap-1">
            <Popover
              onOpenChange={(open) => {
                if (open) markNotificationsRead();
              }}
            >
              <PopoverTrigger asChild>
                <button
                  aria-label="Notifications"
                  className="relative rounded-md p-2 hover:bg-white/10"
                >
                  <Bell className="h-4 w-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-unpaid px-1 text-[10px] font-bold text-white">
                      {notifications.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
                <div className="border-b px-4 py-3 text-sm font-semibold">
                  Notifications
                  {notifications.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({notifications.length} unread)
                    </span>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  <ScrollArea className="max-h-80">
                    <div className="divide-y">
                      {notifications.map((n: any) => (
                        <div key={n.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                          <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-status-unpaid" />
                          <div className="min-w-0">
                            <div className="font-medium text-status-unpaid">{n.title}</div>
                            <div className="mt-0.5 text-muted-foreground">{n.message}</div>
                            <div className="mt-1 text-xs text-muted-foreground/60">
                              {formatDate(n.created_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </PopoverContent>
            </Popover>
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
                search={{}}
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
