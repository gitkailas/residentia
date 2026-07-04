import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { MONTHS, inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/resident/submit")({
  component: SubmitPayment,
});

function SubmitPayment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(MONTHS[today.getMonth()]);
  const [year, setYear] = useState(today.getFullYear());
  const [maintenancePaid, setMaintenancePaid] = useState(0);
  const [garbagePaid, setGarbagePaid] = useState(0);
  const [mode, setMode] = useState("UPI");
  const [refNo, setRefNo] = useState("");
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["resident-submit", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile } = await db
        .from("profiles")
        .select("unit_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (!profile?.unit_id) return { hasUnit: false, unit: null, cycle: null };

      const { data: unit } = await db
        .from("units")
        .select("id, unit_no, type")
        .eq("id", profile.unit_id)
        .single();

      const { data: cycle } = await db
        .from("billing_cycles")
        .select("*")
        .eq("unit_id", profile.unit_id)
        .eq("month", MONTHS[today.getMonth()])
        .eq("year", today.getFullYear())
        .maybeSingle();

      return { hasUnit: true, unit, cycle };
    },
  });

  const totalDue = data?.cycle ? Number(data.cycle.total_due) : 0;
  const totalPaid = Number(maintenancePaid) + Number(garbagePaid);
  const balance = Math.max(totalDue - totalPaid, 0);
  const status = totalPaid === 0 ? "UNPAID" : totalPaid >= totalDue ? "PAID" : "PARTIAL";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.hasUnit || !data?.unit) {
      toast.error("No unit linked");
      return;
    }
    setBusy(true);

    let cycleId: string | null = null;
    const { data: existing } = await db
      .from("billing_cycles")
      .select("id")
      .eq("unit_id", data.unit.id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();
    if (existing) {
      cycleId = existing.id;
    } else {
      const { data: created, error } = await db
        .from("billing_cycles")
        .insert({
          unit_id: data.unit.id,
          month,
          year,
          maintenance_due: 0,
          garbage_due: 0,
          total_due: 0,
          is_waiver_period: false,
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

    const { error } = await db.from("payments").insert({
      billing_cycle_id: cycleId,
      unit_id: data.unit.id,
      amount_maintenance: maintenancePaid,
      amount_garbage: garbagePaid,
      total_paid: totalPaid,
      balance,
      payment_date: date,
      payment_mode: mode,
      reference_no: refNo || null,
      status: "PENDING VERIFICATION",
      recorded_by: user?.email ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Payment proof submitted for verification");
    setMaintenancePaid(0);
    setGarbagePaid(0);
    setRefNo("");
    qc.invalidateQueries({ queryKey: ["resident-payments"] });
  }

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;

  if (!data?.hasUnit) {
    return (
      <Card className="p-6">
        <h2 className="font-semibold">No unit linked</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account isn't linked to a unit yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Submit Payment Proof</h1>
        <p className="text-sm text-muted-foreground">
          Record your maintenance payment for admin verification.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
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
                value={maintenancePaid}
                onChange={(e) => setMaintenancePaid(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Garbage paid</Label>
              <Input
                type="number"
                min={0}
                value={garbagePaid}
                onChange={(e) => setGarbagePaid(Number(e.target.value))}
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

          {(data.cycle || totalPaid > 0) && (
            <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Due</div>
                <div className="font-bold">{inr(totalDue)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Paid</div>
                <div className="font-bold">{inr(totalPaid)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="font-bold">{inr(balance)}</div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={busy || totalPaid === 0}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {busy ? "Submitting…" : "Submit for verification"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Your submission will be marked <strong>Pending Verification</strong> until an admin
            approves it.
          </p>
        </form>
      </Card>
    </div>
  );
}
