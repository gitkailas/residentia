import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { inr, formatDate, MONTHS } from "@/lib/format";
import { Search, Download } from "lucide-react";

export const Route = createFileRoute("/admin/ledger")({
  component: Ledger,
});

const STATUS_ROW: Record<string, string> = {
  PAID: "bg-status-paid/5",
  UNPAID: "bg-status-unpaid/5",
  PARTIAL: "bg-status-partial/5",
  "WAIVER PERIOD": "bg-status-waiver/5",
  "ADVANCE PAID": "bg-status-advance/5",
};

function Ledger() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ledger"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, total_paid, balance, status, payment_date, payment_mode, reference_no, billing_cycles(month, year, total_due), units(unit_no, owner_name, type)")
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState("all");

  const filtered = useMemo(() => {
    return rows.filter((r: any) => {
      if (status !== "all" && r.status !== status) return false;
      if (month !== "all" && r.billing_cycles?.month !== month) return false;
      if (search) {
        const s = search.toLowerCase();
        const ok =
          (r.units?.unit_no ?? "").toLowerCase().includes(s) ||
          (r.units?.owner_name ?? "").toLowerCase().includes(s);
        if (!ok) return false;
      }
      return true;
    });
  }, [rows, search, status, month]);

  function exportCsv() {
    const headers = ["Unit", "Owner", "Month", "Year", "Due", "Paid", "Balance", "Status", "Date", "Mode", "Ref"];
    const lines = [headers.join(",")];
    filtered.forEach((r: any) => {
      lines.push([
        r.units?.unit_no ?? "",
        (r.units?.owner_name ?? "").replace(/,/g, " "),
        r.billing_cycles?.month ?? "",
        r.billing_cycles?.year ?? "",
        r.billing_cycles?.total_due ?? "",
        r.total_paid,
        r.balance,
        r.status,
        formatDate(r.payment_date),
        r.payment_mode ?? "",
        r.reference_no ?? "",
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ledger-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Payment Ledger</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} entries</p>
        </div>
        <Button onClick={exportCsv} variant="outline"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search unit or owner" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["PAID","UNPAID","PARTIAL","WAIVER PERIOD","ADVANCE PAID"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No entries.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Mode</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => (
                  <tr key={r.id} className={`border-t ${STATUS_ROW[r.status] ?? ""}`}>
                    <td className="px-4 py-3 font-semibold">{r.units?.unit_no}</td>
                    <td className="px-4 py-3">{r.units?.owner_name ?? "—"}</td>
                    <td className="px-4 py-3">{r.billing_cycles?.month} {r.billing_cycles?.year}</td>
                    <td className="px-4 py-3 text-right">{inr(r.billing_cycles?.total_due)}</td>
                    <td className="px-4 py-3 text-right font-medium">{inr(r.total_paid)}</td>
                    <td className="px-4 py-3 text-right">{inr(r.balance)}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">{formatDate(r.payment_date)}</td>
                    <td className="px-4 py-3">{r.payment_mode ?? "—"}</td>
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
