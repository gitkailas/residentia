import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/db/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { inr, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { ShieldCheck, ShieldX, Eye, X } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/verification")({
  component: VerifyPayments,
});

function VerifyPayments() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [preview, setPreview] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["pending-verification"],
    queryFn: async () => {
      const { data } = await db
        .from("payments")
        .select(
          "id, unit_id, total_paid, balance, status, payment_date, payment_mode, reference_no, proof_url, recorded_by, amount_maintenance, amount_garbage, billing_cycles(month, year, total_due, maintenance_due, garbage_due, rent_due), units(unit_no, owner_name, type, id)",
        )
        .eq("status", "PENDING VERIFICATION")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function approve(payment: any) {
    const { error } = await db
      .from("payments")
      .update({
        status: "PAID",
        balance: 0,
        approved_by: user?.email ?? null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", payment.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Payment approved — ${payment.units?.unit_no}`);
    qc.invalidateQueries({ queryKey: ["pending-verification"] });
  }

  async function reject(payment: any, reason: string) {
    if (!reason.trim()) {
      toast.error("Enter a reason for rejection");
      return;
    }
    setRejecting(null);
    setRejectReason("");

    const { error } = await db
      .from("payments")
      .update({
        status: "REJECTED",
        approved_by: null,
        approved_at: null,
        rejection_reason: reason,
      })
      .eq("id", payment.id);
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
    qc.invalidateQueries({ queryKey: ["pending-verification"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Verify Payments</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve tenant-submitted payments.
        </p>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : pending.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          <ShieldCheck className="mx-auto h-8 w-8 text-status-paid" />
          <p className="mt-3 font-medium text-foreground">All caught up!</p>
          <p className="mt-1">No pending verifications.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((p: any) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{p.units?.unit_no}</span>
                    <span className="text-sm text-muted-foreground">—</span>
                    <span className="text-sm">{p.units?.owner_name ?? "—"}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
                    <div>
                      <span className="text-xs text-muted-foreground">Period</span>
                      <div className="font-medium">
                        {p.billing_cycles?.month} {p.billing_cycles?.year}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Total due</span>
                      <div className="font-medium">{inr(p.billing_cycles?.total_due ?? 0)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Amount paid</span>
                      <div className="font-medium">{inr(p.total_paid)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Mode</span>
                      <div className="font-medium">{p.payment_mode ?? "—"}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Reference</span>
                      <div className="font-medium">{p.reference_no ?? "—"}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Date</span>
                      <div className="font-medium">{formatDate(p.payment_date)}</div>
                    </div>
                  </div>
                  {p.proof_url && (
                    <div className="pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto gap-1.5 text-xs text-muted-foreground"
                        onClick={() => setPreview(p.proof_url)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View proof
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    className="bg-status-paid hover:bg-status-paid/80 text-white"
                    onClick={() => approve(p)}
                  >
                    <ShieldCheck className="mr-1 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-status-unpaid text-status-unpaid hover:bg-status-unpaid/10"
                    onClick={() => {
                      setRejecting(p);
                      setRejectReason("");
                    }}
                  >
                    <ShieldX className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

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

      <Dialog
        open={!!rejecting}
        onOpenChange={(o) => {
          if (!o) setRejecting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
            <DialogDescription>
              {rejecting &&
                `${rejecting.units?.unit_no} — ${rejecting.billing_cycles?.month} ${rejecting.billing_cycles?.year}`}
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
              <Button variant="outline" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
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
