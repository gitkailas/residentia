import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db/client";
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
      const { data: profile } = await db
        .from("profiles")
        .select("unit_id")
        .eq("id", user!.id)
        .maybeSingle();

      let cycles: any[] = [];
      let payments: any[] = [];

      if (profile?.unit_id) {
        const { data: c } = await db
          .from("billing_cycles")
          .select("*")
          .eq("unit_id", profile.unit_id)
          .order("created_at", { ascending: false });
        cycles = c ?? [];

        const { data: p } = await db
          .from("payments")
          .select("*, billing_cycles(month, year)")
          .eq("unit_id", profile.unit_id)
          .order("created_at", { ascending: false });
        payments = p ?? [];
      }

      return { cycles, payments, hasUnit: !!profile?.unit_id };
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading…</div>;

  if (!data.hasUnit) {
    return (
      <Card className="p-6">
        <h2 className="font-semibold">No unit linked</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account isn't linked to a unit yet.
        </p>
      </Card>
    );
  }

  const paidCycleIds = new Set(data.payments.map((p: any) => p.billing_cycle_id));
  const unpaidCycles = data.cycles.filter((c: any) => !paidCycleIds.has(c.id) && !c.is_waiver_period);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
        <p className="text-sm text-muted-foreground">
          All payment records for your unit.
        </p>
      </div>

      {data.payments.length === 0 && unpaidCycles.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          No billing cycles found for your unit.
        </Card>
      ) : (
        <div className="space-y-2">
          {data.payments.map((p: any) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">
                    {p.billing_cycles?.month} {p.billing_cycles?.year}
                  </div>
                  <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    <div>
                      Paid:{" "}
                      <span className="font-medium text-foreground">{inr(p.total_paid)}</span>
                    </div>
                    <div>
                      Balance:{" "}
                      <span className="font-medium text-foreground">{inr(p.balance)}</span>
                    </div>
                    {p.payment_mode && (
                      <div>
                        Mode: {p.payment_mode}
                        {p.reference_no ? ` · ${p.reference_no}` : ""}
                      </div>
                    )}
                    {p.payment_date && <div>Date: {formatDate(p.payment_date)}</div>}
                    {p.rejection_reason && (
                      <div className="mt-1 rounded-md bg-status-unpaid/10 px-2 py-1 text-xs text-status-unpaid">
                        Rejected: {p.rejection_reason}
                      </div>
                    )}
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            </Card>
          ))}
          {unpaidCycles.map((c: any) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">
                    {c.month} {c.year}
                  </div>
                  <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    <div>
                      Due:{" "}
                      <span className="font-medium text-foreground">{inr(c.total_due)}</span>
                    </div>
                  </div>
                </div>
                <StatusBadge status="UNPAID" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
