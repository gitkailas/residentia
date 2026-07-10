import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useMemo } from "react";
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
import { Upload, IndianRupee, Copy, Check, CreditCard, Loader2, CalendarDays } from "lucide-react";
import QRCode from "qrcode";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}

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
  const { user, session } = useAuth();
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [razorpayBusy, setRazorpayBusy] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
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
      if (!profile?.unit_id)
        return { hasUnit: false, unit: null, cycle: null, existing: null, billedMonths: [] };

      const { data: unit } = await db
        .from("units")
        .select(
          "id, unit_no, type, maintenance_fee, garbage_fee, occupancy_type, monthly_rent, owner_name, owner_user_id",
        )
        .eq("id", profile.unit_id)
        .single();

      let ownerUpiId: string | null = null;
      let ownerName: string | null = null;
      if (unit?.owner_user_id) {
        const { data: ownerProfile } = await db
          .from("profiles")
          .select("upi_id, full_name")
          .eq("id", unit.owner_user_id)
          .maybeSingle();
        ownerUpiId =
          (ownerProfile as { upi_id: string | null; full_name: string | null } | null)?.upi_id ??
          null;
        ownerName =
          (ownerProfile as { upi_id: string | null; full_name: string | null } | null)?.full_name ??
          null;
      }

      const { data: billedCycles } = await db
        .from("billing_cycles")
        .select("month, year")
        .eq("unit_id", profile.unit_id);

      const billedMonths = (billedCycles ?? []).map((c: { month: string; year: number }) => ({
        month: c.month,
        year: c.year,
      }));

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

      return { hasUnit: true, unit, cycle, existing, ownerUpiId, ownerName, billedMonths };
    },
  });

  const { data: razorpayConfig } = useQuery({
    queryKey: ["razorpay-key"],
    queryFn: async () => {
      const res = await fetch("/api/payments/razorpay-key");
      return res.json() as Promise<{ configured: boolean; key_id?: string }>;
    },
  });

  const razorpayConfigured = razorpayConfig?.configured === true;

  const cycle = data?.cycle;
  const billedMonths = useMemo(() => data?.billedMonths ?? [], [data?.billedMonths]);

  const availableMonths = useMemo(
    () => billedMonths.filter((m) => m.year === year).map((m) => m.month),
    [billedMonths, year],
  );

  const availableYears = useMemo(
    () => [...new Set(billedMonths.map((m) => m.year))].sort((a, b) => b - a),
    [billedMonths],
  );

  useEffect(() => {
    if (data?.hasUnit && billedMonths.length > 0 && !cycle) {
      const latest = billedMonths[billedMonths.length - 1];
      if (latest.month !== month || latest.year !== year) {
        setMonth(latest.month);
        setYear(latest.year);
      }
    }
  }, [data?.hasUnit, billedMonths, cycle, month, year]);

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
    } else {
      setMaintenancePaid(0);
      setGarbagePaid(0);
      setRentPaid(0);
    }
  }, [cycle]);

  const upiLink =
    data?.ownerUpiId && totalPaid > 0
      ? `upi://pay?pa=${encodeURIComponent(data.ownerUpiId)}&pn=${encodeURIComponent(data.ownerName ?? "")}&am=${totalPaid}&cu=INR&tn=${encodeURIComponent(`Maintenance ${month} ${year} - ${data.unit?.unit_no}`)}`
      : null;

  useEffect(() => {
    if (mode === "UPI" && upiLink) {
      QRCode.toDataURL(upiLink, { width: 200, margin: 2 }, (err, url) => {
        if (!err) setQrDataUrl(url);
      });
    } else {
      setQrDataUrl(null);
    }
  }, [mode, upiLink]);

  // Load Razorpay Checkout.js dynamically
  useEffect(() => {
    if (razorpayConfigured && !window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => setRazorpayLoaded(true);
      script.onerror = () => console.error("Failed to load Razorpay Checkout.js");
      document.body.appendChild(script);
    } else if (razorpayConfigured && window.Razorpay) {
      setRazorpayLoaded(true);
    }
  }, [razorpayConfigured]);

  async function handleRazorpayPayment() {
    if (!data?.unit || !cycle) {
      toast.error("No billing cycle found");
      return;
    }
    if (totalPaid <= 0) {
      toast.error("Enter at least one payment amount");
      return;
    }
    setRazorpayBusy(true);

    try {
      // 1. Create order on server
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          unit_id: data.unit.id,
          billing_cycle_id: cycle.id,
          amount: totalPaid,
          month,
          year,
          maintenance: maintenancePaid,
          garbage: garbagePaid,
          rent: rentPaid,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok || orderData.error) {
        toast.error(orderData.error?.message || "Failed to create payment order");
        setRazorpayBusy(false);
        return;
      }

      // 2. Open Razorpay Checkout
      const options = {
        key: razorpayConfig!.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Malabar Red Orchids",
        description: `Maintenance ${month} ${year} — ${data.unit.unit_no}`,
        order_id: orderData.order_id,
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          // 3. Verify payment on server
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(session?.access_token
                  ? { Authorization: `Bearer ${session.access_token}` }
                  : {}),
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                unit_id: data.unit!.id,
                billing_cycle_id: cycle.id,
                maintenance: maintenancePaid,
                garbage: garbagePaid,
                rent: rentPaid,
                total: totalPaid,
                month,
                year,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || verifyData.error) {
              toast.error(
                verifyData.error?.message ||
                  "Payment received but verification failed. Contact support.",
              );
            } else {
              toast.success("Payment submitted for owner verification");
              qc.invalidateQueries({ queryKey: ["resident-payments"] });
              qc.invalidateQueries({ queryKey: ["resident-home"] });
              nav({ to: "/resident/payments" });
            }
          } catch {
            toast.error(
              "Payment received but we couldn't verify it. Please contact support with your payment ID.",
            );
          }
          setRazorpayBusy(false);
        },
        prefill: {
          name: data.unit.owner_name || "",
          contact: "",
        },
        theme: {
          color: "#1E3A5F",
        },
        modal: {
          ondismiss: () => {
            setRazorpayBusy(false);
            toast.info("Payment cancelled");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        toast.error("Payment failed. Please try again.");
        setRazorpayBusy(false);
      });
      rzp.open();
    } catch (error) {
      console.error("Razorpay payment initiation failed:", error);
      toast.error("Failed to initiate payment");
      setRazorpayBusy(false);
    }
  }

  async function copyUpiId() {
    if (!data?.ownerUpiId) return;
    try {
      await navigator.clipboard.writeText(data.ownerUpiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

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
      const rFeeCalc =
        data.unit.occupancy_type === "rented" ? Number(data.unit.monthly_rent) || 0 : 0;
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
          <p className="mt-3 font-medium text-foreground">
            Already paid for {month} {year}
          </p>
          <p className="mt-1">This month's bill has been settled.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => nav({ to: "/resident/payments" })}
          >
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

      {!isLoading && data?.hasUnit && !cycle && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium text-foreground">
            No bill generated for {month} {year}
          </p>
          <p className="mt-1">Please wait for the admin to generate your monthly bill.</p>
        </Card>
      )}

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

      {razorpayConfigured && cycle && (
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Pay online with Razorpay</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pay via UPI, cards, netbanking, or wallets. Payment is automatically recorded and
                sent for verification.
              </p>
              <Button
                type="button"
                disabled={razorpayBusy || !razorpayLoaded || totalPaid <= 0}
                className="mt-3 bg-green-600 hover:bg-green-700"
                onClick={handleRazorpayPayment}
              >
                {razorpayBusy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-1.5 h-4 w-4" />
                )}
                Pay {inr(totalPaid)} via Razorpay
              </Button>
              {totalPaid <= 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter payment amounts below to enable online payment.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {razorpayConfigured && cycle && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or pay manually</span>
          </div>
        </div>
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
                  {availableMonths.length > 0
                    ? availableMonths.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))
                    : MONTHS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.length > 0 ? (
                    availableYears.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={String(year)}>{year}</SelectItem>
                  )}
                </SelectContent>
              </Select>
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

            {mode === "UPI" && data?.ownerUpiId && (
              <div className="md:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
                <div className="text-sm font-medium">Pay via UPI</div>

                {totalPaid > 0 && qrDataUrl && (
                  <div className="flex justify-center">
                    <img
                      src={qrDataUrl}
                      alt="UPI QR code"
                      className="h-44 w-44 rounded-lg border bg-white"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">Pay to</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-foreground">
                      {data.ownerUpiId}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={copyUpiId}
                      title="Copy UPI ID"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  {data.ownerName && (
                    <div className="text-xs text-muted-foreground">{data.ownerName}</div>
                  )}
                </div>

                {totalPaid > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={upiLink!} target="_blank" rel="noopener noreferrer">
                      <Button
                        type="button"
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Pay ₹{totalPaid} via UPI
                      </Button>
                    </a>
                    <p className="text-xs text-muted-foreground">
                      Opens on your phone (GPay / PhonePe / Paytm)
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  After paying via UPI, upload a screenshot below as proof and submit for
                  verification.
                </p>
              </div>
            )}

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
