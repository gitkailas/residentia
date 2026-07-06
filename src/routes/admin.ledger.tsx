import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/integrations/db/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { inr, formatDate, MONTHS } from "@/lib/format";
import { generateReceiptPDF } from "@/lib/receipt";
import { toast } from "sonner";
import { Search, Download, FileText, ShieldCheck, ShieldX, Eye, X } from "lucide-react";

export const Route = createFileRoute("/admin/ledger")({
  component: Ledger,
});

const STATUS_ROW: Record<string, string> = {
  PAID: "bg-status-paid/5",
  UNPAID: "bg-status-unpaid/5",
  PARTIAL: "bg-status-partial/5",
  "WAIVER PERIOD": "bg-status-waiver/5",
  "ADVANCE PAID": "bg-status-advance/5",
  REJECTED: "bg-status-unpaid/5",
};

function Ledger() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [preview, setPreview] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-verification-count"],
    queryFn: async () => {
      const { data } = await db
        .from("payments")
        .select("id")
        .eq("status", "PENDING VERIFICATION");
      return (data ?? []).length;
    },
    refetchInterval: 30_000,
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ledger"],
    queryFn: async () => {
      const { data } = await db
        .from("payments")
        .select(
          "id, unit_id, total_paid, balance, status, payment_date, payment_mode, reference_no, proof_url, billing_cycles(month, year, total_due), units(unit_no, owner_name, type)",
        )
        .not("billing_cycle_id", "is", null)
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

  async function approve(payment: any) {
    const { error } = await db.from("payments").update({
      status: "PAID",
      balance: 0,
      approved_by: user?.email ?? null,
      approved_at: new Date().toISOString(),
    }).eq("id", payment.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Payment approved — ${payment.units?.unit_no}`);
    qc.invalidateQueries({ queryKey: ["ledger"] });
    qc.invalidateQueries({ queryKey: ["pending-verification-count"] });
  }

  async function reject(payment: any, reason: string) {
    if (!reason.trim()) {
      toast.error("Enter a reason for rejection");
      return;
    }
    setRejecting(null);
    setRejectReason("");

    const { error } = await db.from("payments").update({
      status: "REJECTED",
      approved_by: null,
      approved_at: null,
      rejection_reason: reason,
    }).eq("id", payment.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    const { data: tenant } = await db
      .from("profiles")
      .select("id")
      .eq("unit_id", payment.unit_id)
      .maybeSingle();

    if (tenant) {
      const month = payment.billing_cycles?.month ?? "";
      const year = payment.billing_cycles?.year ?? "";
      await db.from("notifications").insert({
        user_id: tenant.id,
        title: "Payment Rejected",
        message: `Your payment for ${month} ${year} (${payment.units?.unit_no}) was rejected. Reason: ${reason}`,
        payment_id: payment.id,
        type: "payment_rejected",
      });
    }

    toast.success(`Payment rejected — ${payment.units?.unit_no}`);
    qc.invalidateQueries({ queryKey: ["ledger"] });
    qc.invalidateQueries({ queryKey: ["pending-verification-count"] });
  }

  function exportCsv() {
    const headers = [
      "Unit",
      "Tenant",
      "Month",
      "Year",
      "Due",
      "Paid",
      "Balance",
      "Status",
      "Date",
      "Mode",
      "Ref",
    ];
    const lines = [headers.join(",")];
    filtered.forEach((r: any) => {
      lines.push(
        [
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
        ].join(","),
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Payment Ledger</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} entries
            {pendingCount > 0 && (
              <span className="ml-2 text-status-unpaid">· {pendingCount} pending verification</span>
            )}
          </p>
        </div>
        <Button onClick={exportCsv} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search unit or owner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["PAID", "UNPAID", "PARTIAL", "WAIVER PERIOD", "ADVANCE PAID", "REJECTED"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
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
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => (
                  <tr key={r.id} className={`border-t ${STATUS_ROW[r.status] ?? ""}`}>
                    <td className="px-4 py-3 font-semibold">{r.units?.unit_no}</td>
                    <td className="px-4 py-3">{r.units?.owner_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {r.billing_cycles?.month} {r.billing_cycles?.year}
                    </td>
                    <td className="px-4 py-3 text-right">{inr(r.billing_cycles?.total_due)}</td>
                    <td className="px-4 py-3 text-right font-medium">{inr(r.total_paid)}</td>
                    <td className="px-4 py-3 text-right">{inr(r.balance)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">{formatDate(r.payment_date)}</td>
                    <td className="px-4 py-3">{r.payment_mode ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {r.status === "PENDING VERIFICATION" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-status-paid hover:text-status-paid"
                              onClick={() => approve(r)}
                              title="Approve"
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-status-unpaid hover:text-status-unpaid"
                              onClick={() => { setRejecting(r); setRejectReason(""); }}
                              title="Reject"
                            >
                              <ShieldX className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {r.proof_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreview(r.proof_url)}
                            title="View proof"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            generateReceiptPDF({
                              receiptNo: r.id.slice(0, 8).toUpperCase(),
                              unitNo: r.units?.unit_no ?? "",
                              ownerName: r.units?.owner_name ?? null,
                              type: r.units?.type ?? "",
                              month: r.billing_cycles?.month ?? "—",
                              year: r.billing_cycles?.year ?? "",
                              amountMaintenance: 0,
                              amountGarbage: 0,
                              amountRent: 0,
                              totalPaid: Number(r.total_paid),
                              balance: Number(r.balance),
                              paymentDate: r.payment_date,
                              paymentMode: r.payment_mode,
                              referenceNo: r.reference_no,
                              status: r.status,
                            })
                          }
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-h-[90vh] max-w-lg" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -right-3 -top-3 rounded-full bg-background p-1.5 shadow-md"
              onClick={() => setPreview(null)}
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={preview}
              alt="Payment proof"
              className="max-h-[85vh] w-auto rounded-lg shadow-xl"
            />
          </div>
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
            <DialogDescription>
              {rejecting && `${rejecting.units?.unit_no} — ${rejecting.billing_cycles?.month} ${rejecting.billing_cycles?.year}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for rejection</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter the reason why this payment is being rejected..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => reject(rejecting, rejectReason)}
                disabled={!rejectReason.trim()}
              >
                <ShieldX className="mr-1.5 h-4 w-4" />
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
