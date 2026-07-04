import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { db } from "@/integrations/db/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { Download, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/defaulters")({ component: DefaultersPage });

function DefaultersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["defaulters"],
    queryFn: async () => {
      const [units, cycles, payments] = await Promise.all([
        db
          .from("units")
          .select("id, unit_no, floor, type, owner_name, billing_enabled")
          .eq("status", "sold"),
        db.from("billing_cycles").select("id, unit_id, month, year, total_due, is_waiver_period"),
        db.from("payments").select("billing_cycle_id, total_paid"),
      ]);
      return { units: units.data ?? [], cycles: cycles.data ?? [], payments: payments.data ?? [] };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const paidByCycle = new Map<string, number>();
    for (const p of data.payments) {
      if (!p.billing_cycle_id) continue;
      paidByCycle.set(
        p.billing_cycle_id,
        (paidByCycle.get(p.billing_cycle_id) ?? 0) + Number(p.total_paid),
      );
    }
    const byUnit = new Map<string, { outstanding: number; months: number; oldest: string }>();
    for (const c of data.cycles) {
      if (c.is_waiver_period) continue;
      const paid = paidByCycle.get(c.id) ?? 0;
      const due = Number(c.total_due) - paid;
      if (due <= 0) continue;
      const e = byUnit.get(c.unit_id) ?? {
        outstanding: 0,
        months: 0,
        oldest: `${c.month} ${c.year}`,
      };
      e.outstanding += due;
      e.months += 1;
      byUnit.set(c.unit_id, e);
    }
    return data.units
      .map((u: any) => {
        const e = byUnit.get(u.id);
        if (!e) return null;
        return { ...u, ...e };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.outstanding - a.outstanding);
  }, [data]);

  const totalOutstanding = rows.reduce((s: number, r: any) => s + r.outstanding, 0);

  function exportCsv() {
    const lines = ["Unit,Floor,Type,Owner,Months Due,Outstanding"];
    rows.forEach((r: any) => {
      lines.push(
        [
          r.unit_no,
          r.floor,
          r.type,
          (r.owner_name ?? "").replace(/,/g, " "),
          r.months,
          r.outstanding,
        ].join(","),
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `defaulters-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Defaulters Report</h1>
          <p className="text-sm text-muted-foreground">Units with outstanding maintenance dues.</p>
        </div>
        <Button onClick={exportCsv} variant="outline" disabled={rows.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground">Defaulters</div>
          <div className="mt-1 text-2xl font-bold">{rows.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground">Total outstanding</div>
          <div className="mt-1 text-2xl font-bold text-status-unpaid">{inr(totalOutstanding)}</div>
        </Card>
        <Card className="p-5 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-status-unpaid" />
          <div className="text-sm text-muted-foreground">
            Send reminders to listed units before next billing cycle.
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No defaulters. All units are up to date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Floor</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3 text-right">Months Due</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">{r.unit_no}</td>
                    <td className="px-4 py-3">{r.floor}</td>
                    <td className="px-4 py-3">{r.type}</td>
                    <td className="px-4 py-3">{r.owner_name ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{r.months}</td>
                    <td className="px-4 py-3 text-right font-bold text-status-unpaid">
                      {inr(r.outstanding)}
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
