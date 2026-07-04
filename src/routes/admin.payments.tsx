import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { db } from "@/integrations/db/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr, MONTHS, RATES, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/payments")({
  component: PaymentEntry,
});

function PaymentEntry() {
  const { user, role } = useAuth();
  const { data: units = [] } = useQuery({
    queryKey: ["units-billing-enabled", role === "owner" ? user?.id : "all"],
    queryFn: async () => {
      let query = db
        .from("units")
        .select("id, unit_no, type, owner_name, billing_enabled, waiver_end_date")
        .order("floor")
        .order("unit_no");
      if (role === "owner" && user?.id) {
        query = query.eq("owner_user_id", user.id);
      }
      const { data } = await query;
      return data ?? [];
    },
  });

  const today = new Date();
  const [unitId, setUnitId] = useState<string>("");
  const [month, setMonth] = useState(MONTHS[today.getMonth()]);
  const [year, setYear] = useState(today.getFullYear());
  const [maint, setMaint] = useState<number>(0);
  const [garbage, setGarbage] = useState<number>(0);
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [mode, setMode] = useState("UPI");
  const [refNo, setRefNo] = useState("");
  const [busy, setBusy] = useState(false);

  const unit = useMemo(() => units.find((u: any) => u.id === unitId), [units, unitId]);
  const inWaiver = unit && !unit.billing_enabled;
  const totalDue = unit
    ? (RATES[unit.type as keyof typeof RATES]?.maintenance ?? 0) +
      (RATES[unit.type as keyof typeof RATES]?.garbage ?? 0)
    : 0;
  const totalPaid = Number(maint) + Number(garbage);
  const balance = Math.max(totalDue - totalPaid, 0);
  const status = totalPaid === 0 ? "UNPAID" : totalPaid >= totalDue ? "PAID" : "PARTIAL";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!unit) {
      toast.error("Select a unit");
      return;
    }
    setBusy(true);

    // Ensure billing_cycle exists
    let cycleId: string | null = null;
    const { data: existing } = await db
      .from("billing_cycles")
      .select("id")
      .eq("unit_id", unit.id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();
    if (existing) {
      cycleId = existing.id;
    } else {
      const r = RATES[unit.type as keyof typeof RATES] ?? { maintenance: 0, garbage: 0 };
      const { data: created, error } = await db
        .from("billing_cycles")
        .insert({
          unit_id: unit.id,
          month,
          year,
          maintenance_due: r.maintenance,
          garbage_due: r.garbage,
          total_due: r.maintenance + r.garbage,
          is_waiver_period: !unit.billing_enabled,
        })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      cycleId = created.id;
    }

    // Check for existing payment for this billing cycle to avoid duplicates
    const { data: existingPayment } = await db
      .from("payments")
      .select("id")
      .eq("billing_cycle_id", cycleId)
      .maybeSingle();

    if (existingPayment) {
      const { error: payErr } = await db
        .from("payments")
        .update({
          amount_maintenance: maint,
          amount_garbage: garbage,
          total_paid: totalPaid,
          balance,
          payment_date: date,
          payment_mode: mode,
          reference_no: refNo || null,
          status,
          recorded_by: user?.email ?? null,
        })
        .eq("id", existingPayment.id);
      setBusy(false);
      if (payErr) {
        toast.error(payErr.message);
        return;
      }
      toast.success(`Payment updated — ${status}`);
    } else {
      const { error: payErr } = await db.from("payments").insert({
        billing_cycle_id: cycleId,
        unit_id: unit.id,
        amount_maintenance: maint,
        amount_garbage: garbage,
        total_paid: totalPaid,
        balance,
        payment_date: date,
        payment_mode: mode,
        reference_no: refNo || null,
        status,
        recorded_by: user?.email ?? null,
      });
      setBusy(false);
      if (payErr) {
        toast.error(payErr.message);
        return;
      }
      toast.success(`Payment recorded — ${status}`);
    }
    setMaint(0);
    setGarbage(0);
    setRefNo("");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Record Payment</h1>
        <p className="text-sm text-muted-foreground">
          Enter payment details against a unit's billing cycle.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label>Unit</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a unit" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {units.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.unit_no} — {u.owner_name ?? "—"} {u.billing_enabled ? "" : "(waiver)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {inWaiver && (
            <div className="flex items-start gap-3 rounded-lg border border-status-waiver/30 bg-status-waiver/10 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-status-waiver" />
              <div className="text-sm">
                This unit is in <strong>waiver period</strong> until{" "}
                {formatDate(unit?.waiver_end_date)}. Are you sure you want to record a payment?
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>

            <div className="space-y-2">
              <Label>Maintenance paid</Label>
              <Input
                type="number"
                min={0}
                value={maint}
                onChange={(e) => setMaint(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Garbage paid</Label>
              <Input
                type="number"
                min={0}
                value={garbage}
                onChange={(e) => setGarbage(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["UPI", "NEFT", "Cash", "Cheque"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Reference number</Label>
              <Input
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="UTR / Cheque no."
              />
            </div>
          </div>

          {unit && (
            <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Total due</div>
                <div className="font-bold">{inr(totalDue)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total paid</div>
                <div className="font-bold">{inr(totalPaid)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="font-bold">{inr(balance)}</div>
              </div>
              <div className="col-span-3 flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" /> Will be saved with status{" "}
                <strong className="text-foreground">{status}</strong>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={busy || !unit}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {busy ? "Saving…" : "Record payment"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
