import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/integrations/db/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTHS, RATES, inr } from "@/lib/format";
import { Loader2, IndianRupee, CalendarDays, Building2, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/billing")({
  component: BillingGenerator,
});

function BillingGenerator() {
  const { user, role } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(MONTHS[today.getMonth()]);
  const [year, setYear] = useState(today.getFullYear());
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const isOwner = role === "owner" && !!user?.id;

  const { data: units = [] } = useQuery({
    queryKey: ["units-for-billing", isOwner ? user?.id : "all"],
    queryFn: async () => {
      let query = db.from("units").select("*").order("floor").order("unit_no");
      if (isOwner && user?.id) query = query.eq("owner_user_id", user.id);
      const { data } = await query;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["billing-cycles", month, year, isOwner ? user?.id : "all"],
    queryFn: async () => {
      let query = db
        .from("billing_cycles")
        .select("unit_id, total_due, is_waiver_period")
        .eq("month", month).eq("year", year);
      if (isOwner && user?.id) {
        const { data: ownerUnits } = await db.from("units").select("id").eq("owner_user_id", user.id);
        const ids = (ownerUnits ?? []).map((u: any) => u.id);
        if (ids.length === 0) return [];
        query = query.in("unit_id", ids);
      }
      const { data } = await query;
      return data ?? [];
    },
    enabled: !!user,
  });

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  function availableMonthsFor(y: number) {
    if (y === currentYear) return MONTHS.slice(0, currentMonth + 1);
    if (y < currentYear) return MONTHS;
    return [];
  }

  useEffect(() => {
    const valid = availableMonthsFor(year);
    if (valid.length > 0 && !valid.includes(month)) {
      setMonth(valid[valid.length - 1]);
    }
  }, [year]);

  const monthIndex = MONTHS.indexOf(month);

  function calcDueDate(keyHandoverDate: string | null): string | null {
    if (!keyHandoverDate) return null;
    const day = new Date(keyHandoverDate).getDate();
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const safeDay = Math.min(day, lastDay);
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
  }

  function totalForUnit(u: any): { maintenance: number; garbage: number; rent: number; total: number } {
    const maintenance = Number(u.maintenance_fee) || (RATES[u.type as keyof typeof RATES]?.maintenance ?? 0);
    const garbage = Number(u.garbage_fee) || (RATES[u.type as keyof typeof RATES]?.garbage ?? 0);
    const rent = u.occupancy_type === "rented" ? (Number(u.monthly_rent) || 0) : 0;
    return { maintenance, garbage, rent, total: maintenance + garbage + rent };
  }

  const summary = useMemo(() => {
    const occupied = units.filter((u: any) => u.owner_name && u.status === "sold");
    const existingIds = new Set(existing.map((e: any) => e.unit_id));
    const eligible = occupied.filter((u: any) => !existingIds.has(u.id));
    const ownerOccupied = occupied.filter((u: any) => u.occupancy_type !== "rented");
    const rented = occupied.filter((u: any) => u.occupancy_type === "rented");
    const billable = occupied.filter((u: any) => u.billing_enabled);
    const inWaiver = occupied.filter((u: any) => !u.billing_enabled);
    const generated = existing.length;

    const feeBreakdown = eligible.reduce(
      (acc: { maintenance: number; garbage: number; rent: number; total: number }, u: any) => {
        const fees = totalForUnit(u);
        acc.maintenance += fees.maintenance;
        acc.garbage += fees.garbage;
        acc.rent += fees.rent;
        acc.total += fees.total;
        return acc;
      },
      { maintenance: 0, garbage: 0, rent: 0, total: 0 },
    );

    const dueDays = eligible
      .map((u: any) => {
        if (!u.key_handover_date) return null;
        const d = new Date(u.key_handover_date).getDate();
        return Math.min(d, new Date(year, monthIndex + 1, 0).getDate());
      })
      .filter((d: number | null): d is number => d !== null);

    return {
      occupied: occupied.length,
      ownerOccupied: ownerOccupied.length,
      rented: rented.length,
      billable: billable.length,
      inWaiver: inWaiver.length,
      eligible: eligible.length,
      generated,
      feeBreakdown,
      dueMin: dueDays.length ? Math.min(...dueDays) : null,
      dueMax: dueDays.length ? Math.max(...dueDays) : null,
      eligibleUnits: eligible,
      displayUnits: occupied.map((u: any) => ({
        ...u,
        hasCycle: existingIds.has(u.id),
      })),
    };
  }, [units, existing]);

  async function generateForUnit(u: any) {
    setGeneratingId(u.id);
    const fees = totalForUnit(u);
    const { error } = await db.from("billing_cycles").insert({
      unit_id: u.id,
      month, year,
      maintenance_due: Number(fees.maintenance) || 0,
      garbage_due: Number(fees.garbage) || 0,
      rent_due: Number(fees.rent) || 0,
      total_due: Number(fees.total) || 0,
      is_waiver_period: !u.billing_enabled,
    });
    setGeneratingId(null);
    if (error) { toast.error(error.message); return; }
    setGeneratedIds(prev => new Set(prev).add(u.id));
    toast.success(`Bill generated for ${u.unit_no}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Monthly Billing Generator</h1>
        <p className="text-sm text-muted-foreground">
          Create billing cycles for occupied units. Due date matches each unit's key handover day of month. Rent is included for rented units.
        </p>
      </div>

      <Card className="p-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableMonthsFor(year).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Year</Label>
            <Input type="number" min={2020} max={currentYear} value={year} onChange={(e) => setYear(Math.min(Number(e.target.value), currentYear))} />
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={Building2} label="Occupied" value={summary.occupied} hint={`${summary.ownerOccupied} owner · ${summary.rented} rented`} />
          <Stat icon={Users} label="Billable" value={summary.billable} hint={`${summary.inWaiver} in waiver`} />
          <Stat icon={CalendarDays} label="Due dates" value={summary.dueMin && summary.dueMax ? `${summary.dueMin}th – ${summary.dueMax}th` : "—"} hint="based on key handover" />
          <Stat icon={Loader2} label="Already generated" value={summary.generated} hint={`${month} ${year}`} />
        </div>

        {/* Expected collection breakdown */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <IndianRupee className="h-4 w-4" />
            Expected collection <span className="font-normal text-muted-foreground">(for {summary.eligible} units not yet generated)</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>Maintenance: <strong>{inr(summary.feeBreakdown.maintenance)}</strong></span>
            <span>Garbage: <strong>{inr(summary.feeBreakdown.garbage)}</strong></span>
            {summary.feeBreakdown.rent > 0 && <span>Rent: <strong>{inr(summary.feeBreakdown.rent)}</strong></span>}
            <span className="text-primary font-bold">Total: {inr(summary.feeBreakdown.total)}</span>
          </div>
        </div>

        {/* Preview table */}
        {summary.displayUnits.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2 text-left">Unit</th>
                  <th className="px-3 py-2 text-left">Tenant</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Occupancy</th>
                  <th className="px-3 py-2 text-right">Maintenance</th>
                  <th className="px-3 py-2 text-right">Garbage</th>
                  <th className="px-3 py-2 text-right">Rent</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Due date</th>
                  <th className="px-3 py-2 text-center">Bill</th>
                </tr>
              </thead>
              <tbody>
                {summary.displayUnits
                  .map((u: any) => {
                    const fees = totalForUnit(u);
                    const khDate = u.key_handover_date ? new Date(u.key_handover_date) : null;
                    const isDue = khDate
                      ? (khDate.getFullYear() < year ||
                         (khDate.getFullYear() === year && khDate.getMonth() <= monthIndex))
                      : false;
                    const isGen = u.hasCycle || generatedIds.has(u.id);
                    return { ...u, fees, day: u.key_handover_date ? `${new Date(u.key_handover_date).getDate()}th` : "—", isDue, isGen };
                  })
                  .sort((a: any, b: any) => (a.isGen === b.isGen ? 0 : a.isGen ? 1 : -1))
                  .map((u: any) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{u.unit_no}</td>
                      <td className="px-3 py-2">{u.owner_name ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{u.type}</td>
                      <td className="px-3 py-2">
                        <span className={u.occupancy_type === "rented" ? "text-amber-600" : "text-green-600"}>
                          {u.occupancy_type === "rented" ? "Rented" : "Owner"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{inr(u.fees.maintenance)}</td>
                      <td className="px-3 py-2 text-right">{inr(u.fees.garbage)}</td>
                      <td className="px-3 py-2 text-right">{u.fees.rent > 0 ? inr(u.fees.rent) : "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold">{inr(u.fees.total)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{u.day}</td>
                      <td className="px-3 py-2 text-center">
                        {u.isGen ? (
                          <span className="text-xs text-green-600 font-medium">Generated</span>
                        ) : !u.isDue ? (
                          <Button size="sm" disabled className="text-xs h-7 px-2">Generate</Button>
                        ) : (
                          <Button size="sm" onClick={() => generateForUnit(u)} disabled={generatingId === u.id} className="text-xs h-7 px-2">
                            {generatingId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: number | string; hint?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="text-xl font-bold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
