import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
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
import { Upload, IndianRupee } from "lucide-react";

export const Route = createFileRoute("/resident/submit")({
  validateSearch: (search: Record<string, unknown>) => ({
    month: typeof search.month === "string" ? search.month : undefined,
    year: typeof search.year === "string" ? parseInt(search.year) || undefined : undefined,
  }),
  component: SubmitPayment,
});

function SubmitPayment() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { user } = useAuth();
  const search = useSearch({ from: "/resident/submit" });
  const today = new Date();
  const [month, setMonth] = useState(search.month ?? MONTHS[today.getMonth()]);
  const [year, setYear] = useState(search.year ?? today.getFullYear());
  const [maintenancePaid, setMaintenancePaid] = useState(0);
  const [garbagePaid, setGarbagePaid] = useState(0);
  const [rentPaid, setRentPaid] = useState(0);
  const [mode, setMode] = useState("UPI");
  const [refNo, setRefNo] = useState("");
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [proofBase64, setProofBase64] = useState<string | null>(null);
  const [proofName, setProofName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["resident-submit", user?.id, month, year],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile } = await db
        .from("profiles")
        .select("unit_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (!profile?.unit_id) return { hasUnit: false, unit: null, cycle: null, existing: null };

      const { data: unit } = await db
        .from("units")
        .select("id, unit_no, type, maintenance_fee, garbage_fee, occupancy_type, monthly_rent")
        .eq("id", profile.unit_id)
        .single();

      const { data: cycle } = await db
        .from("billing_cycles")
        .select("*")
        .eq("unit_id", profile.unit_id)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();

      const { data: existing } = await db
        .from("payments")
        .select("id, status")
        .eq("unit_id", profile.unit_id)
        .eq("billing_cycle_id", cycle?.id)
        .maybeSingle();

      return { hasUnit: true, unit, cycle, existing };
    },
  });

  const cycle = data?.cycle;
  const mFee = cycle ? Number(cycle.maintenance_due) : 0;
  const gFee = cycle ? Number(cycle.garbage_due) : 0;
  const rFee = cycle ? Number(cycle.rent_due) : 0;
  const totalDue = cycle ? Number(cycle.total_due) : 0;
  const totalPaid = Number(maintenancePaid) + Number(garbagePaid) + Number(rentPaid);
  const balance = Math.max(totalDue - totalPaid, 0);

  useEffect(() => {
    if (cycle) {
      setMaintenancePaid(Number(cycle.maintenance_due));
      setGarbagePaid(Number(cycle.garbage_due));
      if (Number(cycle.rent_due) > 0) setRentPaid(Number(cycle.rent_due));
    }
  }, [cycle]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofName(file.name);
    const reader = new FileReader();
    reader.onload = () => setProofBase64(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.hasUnit || !data?.unit) {
      toast.error("No unit linked");
      return;
    }
    if (!date) {
      toast.error("Select a payment date");
      return;
    }
    if (maintenancePaid <= 0 && garbagePaid <= 0 && rentPaid <= 0) {
      toast.error("Enter at least one payment amount");
      return;
    }
    if (!proofBase64) {
      toast.error("Upload a payment proof screenshot or receipt");
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
      const mFeeCalc = Number(data.unit.maintenance_fee) || 0;
      const gFeeCalc = Number(data.unit.garbage_fee) || 0;
      const rFeeCalc = data.unit.occupancy_type === "rented" ? (Number(data.unit.monthly_rent) || 0) : 0;
      const { data: created, error } = await db
        .from("billing_cycles")
        .insert({
          unit_id: data.unit.id,
          month,
          year,
          maintenance_due: mFeeCalc,
          garbage_due: gFeeCalc,
          rent_due: rFeeCalc,
          total_due: mFeeCalc + gFeeCalc + rFeeCalc,
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
      proof_url: proofBase64,
      status: "PENDING VERIFICATION",
      recorded_by: user?.email ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Payment submitted for owner verification");
    setMaintenancePaid(0);
    setGarbagePaid(0);
    setRentPaid(0);
    setRefNo("");
    setProofBase64(null);
    setProofName("");
    if (fileRef.current) fileRef.current.value = "";
    qc.invalidateQueries({ queryKey: ["resident-payments"] });
    qc.invalidateQueries({ queryKey: ["resident-home"] });
    nav({ to: "/resident/payments" });
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

  const alreadyPaid = data.existing && data.existing.status === "PAID";

  if (alreadyPaid) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Make Payment</h1>
        </div>
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <IndianRupee className="mx-auto h-8 w-8 text-status-paid" />
          <p className="mt-3 font-medium text-foreground">Already paid for {month} {year}</p>
          <p className="mt-1">This month's bill has been settled.</p>
          <Button variant="outline" className="mt-4" onClick={() => nav({ to: "/resident/payments" })}>
            View payment history
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Make Payment</h1>
        <p className="text-sm text-muted-foreground">
          Pay your maintenance bill and submit for verification.
        </p>
      </div>

      {cycle && (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Bill for</div>
          <div className="mt-1 text-lg font-bold">
            {cycle.month} {cycle.year}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Maintenance</span>
              <div className="font-semibold">{inr(mFee)}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Garbage</span>
              <div className="font-semibold">{inr(gFee)}</div>
            </div>
            {rFee > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">Rent</span>
                <div className="font-semibold">{inr(rFee)}</div>
              </div>
            )}
            <div className="col-span-3 border-t pt-2">
              <span className="text-xs text-muted-foreground">Total due</span>
              <div className="text-xl font-bold text-primary">{inr(totalDue)}</div>
            </div>
          </div>
        </Card>
      )}

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
                required
                value={maintenancePaid}
                onChange={(e) => setMaintenancePaid(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Garbage paid</Label>
              <Input
                type="number"
                min={0}
                required
                value={garbagePaid}
                onChange={(e) => setGarbagePaid(Number(e.target.value))}
              />
            </div>
            {rFee > 0 && (
              <div className="space-y-2">
                <Label>Rent paid</Label>
                <Input
                  type="number"
                  min={0}
                  required
                  value={rentPaid}
                  onChange={(e) => setRentPaid(Number(e.target.value))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Payment date</Label>
              <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
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
              <Label>Reference number (optional)</Label>
              <Input
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="UTR / Cheque no. / Cash receipt no."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Payment proof (screenshot / receipt photo)</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  {proofName ? "Change file" : "Upload file"}
                </Button>
                {proofName && (
                  <span className="truncate text-xs text-muted-foreground">{proofName}</span>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
              <p className="text-xs text-muted-foreground">
                Upload a screenshot of your UPI payment, NEFT receipt, or cash receipt.
              </p>
              {proofBase64 && (
                <img
                  src={proofBase64}
                  alt="Preview"
                  className="mt-2 max-h-40 rounded border object-contain"
                />
              )}
            </div>
          </div>

          {totalPaid > 0 && (
            <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Due</div>
                <div className="font-bold">{inr(totalDue)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">You pay</div>
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
            disabled={busy || totalPaid <= 0}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {busy ? "Submitting…" : "Submit for verification"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Your submission will be marked <strong>Pending Verification</strong> until the owner
            approves it. Payments via UPI (Google Pay, PhonePe), NEFT, Cheque, or Cash are all
            supported — just upload the proof.
          </p>
        </form>
      </Card>
    </div>
  );
}
