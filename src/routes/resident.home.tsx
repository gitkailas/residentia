import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { inr, formatDate, MONTHS, RATES } from "@/lib/format";
import { Info, Megaphone, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/resident/home")({
  component: ResidentHome,
});

function ResidentHome() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["resident-home", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date();
      const month = MONTHS[today.getMonth()];
      const year = today.getFullYear();

      const { data: profile } = await db
        .from("profiles")
        .select("full_name, unit_id")
        .eq("id", user!.id)
        .maybeSingle();

      let unit: any = null;
      let cycle: any = null;
      let otherCycles: any[] = [];
      let payments: any[] = [];

      if (profile?.unit_id) {
        const { data: u } = await db.from("units").select("*").eq("id", profile.unit_id).single();
        unit = u;
        const { data: allCycles } = await db
          .from("billing_cycles")
          .select("*")
          .eq("unit_id", profile.unit_id)
          .order("year", { ascending: false })
          .order("created_at", { ascending: false });
        const sortedCycles = allCycles ?? [];
        cycle = sortedCycles.find((c: any) => c.month === month && c.year === year) ?? null;
        otherCycles = sortedCycles.filter((c: any) => c.id !== cycle?.id);
        const { data: p } = await db
          .from("payments")
          .select("total_paid, balance, status, billing_cycle_id")
          .eq("unit_id", profile.unit_id);
        payments = p ?? [];
      }

      const { data: announcements } = await db
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);

      return { profile, unit, cycle, otherCycles, payments, announcements: announcements ?? [], month, year };
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading…</div>;

  const { profile, unit, cycle, otherCycles = [], payments, announcements, month, year } = data;

  if (!profile?.unit_id || !unit) {
    return (
      <Card className="p-6">
        <h2 className="font-semibold">Welcome to Residentia</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account isn't linked to a unit yet. Please contact your society admin.
        </p>
      </Card>
    );
  }

  const inWaiver = unit.status === "sold" && !unit.billing_enabled;
  const mFee = Number(unit.maintenance_fee) || (RATES[unit.type as keyof typeof RATES]?.maintenance ?? 0);
  const gFee = Number(unit.garbage_fee) || (RATES[unit.type as keyof typeof RATES]?.garbage ?? 0);
  const rFee = unit.occupancy_type === "rented" ? (Number(unit.monthly_rent) || 0) : 0;
  const monthCycle = cycle ?? {
    maintenance_due: mFee,
    garbage_due: gFee,
    rent_due: rFee,
    total_due: mFee + gFee + rFee,
  };
  const monthPayment = payments.find((p) => p.billing_cycle_id === cycle?.id);
  const status = monthPayment?.status ?? (inWaiver ? "WAIVER PERIOD" : "UNPAID");
  const payByCycleId = new Map(payments.map((p: any) => [p.billing_cycle_id, p]));
  const totalOutstanding = [...(cycle ? [cycle] : []), ...otherCycles].reduce((sum, c) => {
    const payment = payByCycleId.get(c.id);
    if (payment) return sum + Number(payment.balance ?? 0);
    if (c.is_waiver_period) return sum;
    return sum + Number(c.total_due ?? 0);
  }, 0);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Welcome</div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hello {profile.full_name?.split(" ")[0] ?? "Resident"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Unit {unit.unit_no} · Floor {unit.floor} · {unit.type}
        </p>
      </div>

      {inWaiver && (
        <Card className="border-status-waiver/30 bg-status-waiver/10 p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-status-waiver" />
            <div className="text-sm">
              <div className="font-semibold text-status-waiver">
                You're in maintenance waiver period
              </div>
              <p className="mt-1 text-foreground/80">
                No dues are applicable until <strong>{formatDate(unit.waiver_end_date)}</strong>.
                Billing begins from{" "}
                <strong>
                  {unit.waiver_end_date
                    ? new Date(
                        new Date(unit.waiver_end_date).setMonth(
                          new Date(unit.waiver_end_date).getMonth() + 1,
                        ),
                      ).toLocaleString("en-IN", { month: "long", year: "numeric" })
                    : "—"}
                </strong>
                .
              </p>
            </div>
          </div>
        </Card>
      )}

      {!inWaiver && (
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {month} {year}
              </div>
              <div className="mt-1 text-lg font-bold">Resident Charges</div>
            </div>
            <StatusBadge status={status} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Maintenance</div>
              <div className="font-bold">{inr(monthCycle.maintenance_due)}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Garbage</div>
              <div className="font-bold">{inr(monthCycle.garbage_due)}</div>
            </div>
            {(monthCycle.rent_due ?? 0) > 0 && (
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Rent</div>
                <div className="font-bold">{inr(monthCycle.rent_due)}</div>
              </div>
            )}
            <div className="col-span-2 rounded-lg bg-primary p-3 text-primary-foreground">
              <div className="text-xs opacity-80">Total due</div>
              <div className="text-2xl font-bold">{inr(monthCycle.total_due)}</div>
            </div>
          </div>
          {status !== "PAID" && (
            <Link to="/resident/submit" search={{ month, year }} className="mt-4 block">
              <Button className="w-full gap-2">
                Pay Now <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </Card>
      )}

      {otherCycles.map((oc: any) => {
        const ocPay = payByCycleId.get(oc.id);
        const ocStatus = ocPay?.status ?? (oc.is_waiver_period ? "WAIVER PERIOD" : "UNPAID");
        return (
          <Card key={oc.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {oc.month} {oc.year}
                </div>
                <div className="mt-1 text-lg font-bold">Resident Charges</div>
              </div>
              <StatusBadge status={ocStatus} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Maintenance</div>
                <div className="font-bold">{inr(oc.maintenance_due)}</div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Garbage</div>
                <div className="font-bold">{inr(oc.garbage_due)}</div>
              </div>
              {(oc.rent_due ?? 0) > 0 && (
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">Rent</div>
                  <div className="font-bold">{inr(oc.rent_due)}</div>
                </div>
              )}
              <div className="col-span-2 rounded-lg bg-primary p-3 text-primary-foreground">
                <div className="text-xs opacity-80">Total due</div>
                <div className="text-2xl font-bold">{inr(oc.total_due)}</div>
              </div>
            </div>
            {ocStatus !== "PAID" && (
              <Link to="/resident/submit" search={{ month: oc.month, year: oc.year }} className="mt-4 block">
                <Button className="w-full gap-2">
                  Pay Now <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </Card>
        );
      })}

      {totalOutstanding > 0 && (
        <Card className="border-status-unpaid/30 bg-status-unpaid/5 p-4">
          <div className="text-xs uppercase tracking-wider text-status-unpaid">Outstanding</div>
          <div className="mt-1 text-2xl font-bold text-status-unpaid">{inr(totalOutstanding)}</div>
          <div className="text-xs text-muted-foreground">Across all unpaid months</div>
        </Card>
      )}

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Announcements
          </h2>
        </div>
        {announcements.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No announcements.</Card>
        ) : (
          <div className="space-y-2">
            {announcements.map((a: any) => (
              <Card key={a.id} className="p-4">
                <div className="font-semibold">{a.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{a.message}</div>
                <div className="mt-2 text-xs text-muted-foreground">{formatDate(a.created_at)}</div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
