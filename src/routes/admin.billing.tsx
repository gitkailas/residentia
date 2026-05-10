import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTHS, RATES, inr } from "@/lib/format";
import { Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/billing")({
  component: BillingGenerator,
});

function BillingGenerator() {
  const qc = useQueryClient();
  const today = new Date();
  const [month, setMonth] = useState(MONTHS[today.getMonth()]);
  const [year, setYear] = useState(today.getFullYear());
  const [busy, setBusy] = useState(false);

  const { data: units = [] } = useQuery({
    queryKey: ["units-for-billing"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("*").order("floor").order("unit_no");
      return data ?? [];
    },
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["billing-cycles", month, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_cycles")
        .select("unit_id, total_due, is_waiver_period")
        .eq("month", month).eq("year", year);
      return data ?? [];
    },
  });

  const summary = useMemo(() => {
    const eligible = units.filter((u: any) => u.status === "sold");
    const billable = eligible.filter((u: any) => u.billing_enabled);
    const inWaiver = eligible.filter((u: any) => !u.billing_enabled);
    const generated = existing.length;
    const totalExpected = billable.reduce((s: number, u: any) => {
      const r = RATES[u.type as keyof typeof RATES];
      return s + (r?.maintenance ?? 0) + (r?.garbage ?? 0);
    }, 0);
    return { eligible: eligible.length, billable: billable.length, inWaiver: inWaiver.length, generated, totalExpected };
  }, [units, existing]);

  async function generate() {
    setBusy(true);
    const existingIds = new Set(existing.map((e: any) => e.unit_id));
    const eligible = units.filter((u: any) => u.status === "sold" && !existingIds.has(u.id));
    if (eligible.length === 0) {
      toast.info("All eligible units already have a cycle for this period.");
      setBusy(false);
      return;
    }
    const rows = eligible.map((u: any) => {
      const r = RATES[u.type as keyof typeof RATES] ?? { maintenance: 0, garbage: 0 };
      return {
        unit_id: u.id,
        month, year,
        maintenance_due: r.maintenance,
        garbage_due: r.garbage,
        total_due: r.maintenance + r.garbage,
        is_waiver_period: !u.billing_enabled,
      };
    });
    const { error } = await supabase.from("billing_cycles").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Generated ${rows.length} billing cycle(s) for ${month} ${year}`);
    qc.invalidateQueries({ queryKey: ["billing-cycles"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Monthly Billing Generator</h1>
        <p className="text-sm text-muted-foreground">Create a billing cycle entry for every sold unit for the selected month.</p>
      </div>

      <Card className="p-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Year</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-4">
          <Stat label="Sold units" value={summary.eligible} />
          <Stat label="Billable" value={summary.billable} hint="active billing" />
          <Stat label="In waiver" value={summary.inWaiver} hint="0 due" />
          <Stat label="Already generated" value={summary.generated} hint={`${month} ${year}`} />
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          Expected collection if generated now: <strong>{inr(summary.totalExpected)}</strong>
        </div>

        <Button onClick={generate} disabled={busy} className="w-full bg-primary hover:bg-primary/90">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          Generate cycles for {month} {year}
        </Button>
        <p className="text-xs text-muted-foreground">
          Skips units that already have a cycle for this period. Units in waiver are added with <code>is_waiver_period = true</code>.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
