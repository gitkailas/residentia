import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/integrations/db/client";
import { Card } from "@/components/ui/card";
import { inr, formatDate, MONTHS } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Building2,
  BadgeCheck,
  CalendarClock,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  component: Dashboard,
});

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-lg ${accent ?? "bg-primary/10 text-primary"}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 truncate text-2xl font-bold">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </Card>
  );
}

function Dashboard() {
  const { user, role } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard", role === "owner" ? user?.id : "all"],
    queryFn: async () => {
      const today = new Date();
      const monthName = MONTHS[today.getMonth()];
      const year = today.getFullYear();

      // If owner, first fetch assigned unit IDs for scoping
      let ownerUnitIds: string[] = [];
      const isOwner = role === "owner" && !!user?.id;
      if (isOwner) {
        const result = await db.from("units").select("id").eq("owner_user_id", user.id);
        ownerUnitIds = (result.data ?? []).map((u: any) => u.id);
        if (ownerUnitIds.length === 0) {
          return {
            units: [],
            billing: [],
            payments: [],
            recent: [],
            expiring: [],
            monthName,
            year,
          };
        }
      }

      let unitsQuery = db.from("units").select("*");
      let billingQuery = db
        .from("billing_cycles")
        .select("*")
        .eq("month", monthName)
        .eq("year", year);
      let paymentsQuery = db
        .from("payments")
        .select("total_paid, balance, status, unit_id, billing_cycles(month, year)");
      let recentQuery = db
        .from("payments")
        .select("id, total_paid, payment_date, payment_mode, unit_id, billing_cycles(month, year), units(unit_no, owner_name)")
        .eq("status", "PAID")
        .order("created_at", { ascending: false })
        .limit(10);
      let expiringQuery = db
        .from("units")
        .select("unit_no, owner_name, waiver_end_date")
        .not("waiver_end_date", "is", null);

      if (isOwner) {
        unitsQuery = unitsQuery.eq("owner_user_id", user.id);
        expiringQuery = expiringQuery.eq("owner_user_id", user.id);
        if (ownerUnitIds.length > 0) {
          billingQuery = billingQuery.in("unit_id", ownerUnitIds);
          paymentsQuery = paymentsQuery.in("unit_id", ownerUnitIds);
          recentQuery = recentQuery.in("unit_id", ownerUnitIds);
        }
      }

      const [units, billing, payments, recent, expiring] = await Promise.all([
        unitsQuery,
        billingQuery,
        paymentsQuery,
        recentQuery,
        expiringQuery,
      ]);

      return {
        units: units.data ?? [],
        billing: billing.data ?? [],
        payments: payments.data ?? [],
        recent: recent.data ?? [],
        expiring: (expiring.data ?? []).filter((u: any) => {
          if (!u.waiver_end_date) return false;
          const d = new Date(u.waiver_end_date);
          const diff = (d.getTime() - today.getTime()) / 86400000;
          return diff >= 0 && diff <= 30;
        }),
        monthName,
        year,
      };
    },
  });

  if (isLoading || !data) {
    return <div className="text-muted-foreground">Loading dashboard…</div>;
  }

  const total = data.units.length;
  const sold = data.units.filter((u: any) => u.status === "sold").length;
  const unsold = data.units.filter((u: any) => u.status !== "sold").length;
  const totalTenants = data.units.filter((u: any) => u.status === "sold" && u.owner_name).length;
  const inWaiver = data.units.filter((u: any) => u.status === "sold" && !u.billing_enabled).length;
  const billingActive = data.units.filter((u: any) => u.billing_enabled).length;

  const chartData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const m = MONTHS[d.getMonth()];
    const y = d.getFullYear();
    const collected = data.payments
      .filter((p: any) => {
        if (p.status !== "PAID") return false;
        return p.billing_cycles?.month === m && p.billing_cycles?.year === y;
      })
      .reduce((s: number, p: any) => s + Number(p.total_paid), 0);
    return { month: m.slice(0, 3), collected };
  });

  const statusCounts = ["PAID", "UNPAID", "PARTIAL", "WAIVER PERIOD"].map((st) => ({
    name: st,
    value: data.payments.filter((p: any) => p.status === st).length,
  }));
  const PIE_COLORS = ["#16A34A", "#DC2626", "#D97706", "#3B82F6"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">RWA Malabar Red Orchids</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          icon={Building2}
          label="Total Units"
          value={String(total)}
          hint={`${sold} sold · ${unsold} unsold`}
        />
        <Stat
          icon={Users}
          label="Total Tenants"
          value={String(totalTenants)}
          accent="bg-status-paid/10 text-status-paid"
        />
        <Stat
          icon={BadgeCheck}
          label="Billing Active"
          value={String(billingActive)}
          accent="bg-status-paid/10 text-status-paid"
        />
        <Stat
          icon={CalendarClock}
          label="In Waiver Period"
          value={String(inWaiver)}
          accent="bg-status-waiver/10 text-status-waiver"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Collection Report</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v: any) => inr(Number(v))} />
                <Bar dataKey="collected" fill="#1E3A5F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Status — current month</h2>
          {statusCounts.every((s) => s.value === 0) ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No data yet — generate this month's bills.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusCounts}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={80}
                  >
                    {statusCounts.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Recent Payments</h2>
        {data.recent.length === 0 ? (
          <div className="text-sm text-muted-foreground">No payments recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-3">Unit</th>
                  <th className="pb-3">Owner</th>
                  <th className="pb-3">Bill Month</th>
                  <th className="pb-3">Payment Date</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((p: any) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-3 font-medium">{p.units?.unit_no ?? "—"}</td>
                    <td className="py-3">{p.units?.owner_name ?? "—"}</td>
                    <td className="py-3">{p.billing_cycles?.month ?? "—"} {p.billing_cycles?.year ?? ""}</td>
                    <td className="py-3">{formatDate(p.payment_date)}</td>
                    <td className="py-3 text-right font-semibold">{inr(p.total_paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data.expiring.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-2 text-lg font-semibold">Waivers expiring soon</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Units whose 6-month waiver ends within the next 30 days.
          </p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.expiring.map((u: any) => (
              <div
                key={u.unit_no}
                className="flex items-center justify-between rounded-lg border bg-card p-3"
              >
                <div>
                  <div className="font-semibold">Unit {u.unit_no}</div>
                  <div className="text-xs text-muted-foreground">{u.owner_name ?? "—"}</div>
                </div>
                <StatusBadge status="WAIVER PERIOD" />
                <div className="text-xs text-muted-foreground">
                  ends {formatDate(u.waiver_end_date)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
