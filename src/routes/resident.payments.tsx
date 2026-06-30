import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { inr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/resident/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["resident-payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles").select("unit_id").eq("id", user!.id).maybeSingle();

      let cycles: any[] = [];
      let payments: any[] = [];

      if (profile?.unit_id) {
        const { data: c } = await supabase
          .from("billing_cycles").select("*")
          .eq("unit_id", profile.unit_id)
          .order("created_at", { ascending: false });
        cycles = c ?? [];

        const { data: p } = await supabase
          .from("payments").select("*, billing_cycles!inner(month, year)")
          .eq("unit_id", profile.unit_id)
          .order("created_at", { ascending: false });
        payments = p ?? [];
      }

      const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.total_paid ?? 0), 0);
      const totalBalance = payments.reduce((s: number, p: any) => s + Number(p.balance ?? 0), 0);

      return { cycles, payments, totalPaid, totalBalance, hasUnit: !!profile?.unit_id };
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading…</div>;

  if (!data.hasUnit) {
    return (
      <Card className="p-6">
        <h2 className="font-semibold">No unit linked</h2>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn't linked to a unit yet.</p>
      </Card>
    );
  }

  const payByCycle = new Map(data.payments.map((p: any) => [p.billing_cycle_id, p]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
        <p className="text-sm text-muted-foreground">Monthly breakdown of your maintenance payments.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-status-paid/30 bg-status-paid/5 p-4">
          <div className="text-xs uppercase tracking-wider text-status-paid">Total Paid</div>
          <div className="mt-1 text-xl font-bold text-status-paid">{inr(data.totalPaid)}</div>
        </Card>
        <Card className="border-status-unpaid/30 bg-status-unpaid/5 p-4">
          <div className="text-xs uppercase tracking-wider text-status-unpaid">Outstanding</div>
          <div className="mt-1 text-xl font-bold text-status-unpaid">{inr(data.totalBalance)}</div>
        </Card>
      </div>

      {data.cycles.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          No billing cycles found for your unit.
        </Card>
      ) : (
        <div className="space-y-2">
          {data.cycles.map((cycle: any) => {
            const pay = payByCycle.get(cycle.id);
            const status = pay?.status ?? (cycle.is_waiver_period ? "WAIVER PERIOD" : "UNPAID");
            return (
              <Card key={cycle.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{cycle.month} {cycle.year}</div>
                    <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                      <div>Due: <span className="font-medium text-foreground">{inr(cycle.total_due)}</span></div>
                      <div>Paid: <span className="font-medium text-foreground">{inr(pay?.total_paid ?? 0)}</span></div>
                      {pay && <div>Balance: <span className="font-medium text-foreground">{inr(pay.balance)}</span></div>}
                      {pay?.payment_mode && <div>Mode: {pay.payment_mode}{pay.reference_no ? ` · ${pay.reference_no}` : ""}</div>}
                      {pay?.payment_date && <div>Date: {formatDate(pay.payment_date)}</div>}
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
