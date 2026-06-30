import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, IndianRupee } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/pricing")({
  component: PricingPage,
});

interface Pricing {
  id: string;
  unit_type: string;
  monthly_rent: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const UNIT_TYPES = ["1BHK", "2BHK", "3BHK", "4BHK", "5BHK", "6BHK"];

function PricingPage() {
  const qc = useQueryClient();
  const { session, role } = useAuth();
  const isMaster = role === "master_admin";
  const userId = session?.user?.id;

  const { data: allPricing = [], isLoading } = useQuery({
    queryKey: ["pricing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pricing").select("*").order("unit_type");
      if (error) throw error;
      return (data ?? []) as Pricing[];
    },
  });

  const pricing = isMaster ? allPricing : allPricing.filter((p) => p.created_by === userId);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pricing | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Pricing</h1>
          <p className="text-sm text-muted-foreground">
            {isMaster ? `${allPricing.length} rates configured` : "Set your monthly rent per unit type"}
          </p>
        </div>
        {!isMaster && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90"><Plus className="mr-1 h-4 w-4" />Add Pricing</Button>
            </DialogTrigger>
            <PricingDialog
              key={editing?.id ?? "new"}
              editing={editing}
              userId={userId!}
              onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["pricing"] }); }}
            />
          </Dialog>
        )}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : pricing.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {isMaster
              ? "No pricing configured by any owner yet."
              : "No pricing set yet. Click Add Pricing to set monthly rent for your property types."
            }
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Unit Type</th>
                  <th className="px-4 py-3">Monthly Rent</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {pricing.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">{p.unit_type}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                        {p.monthly_rent.toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(p.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isMaster && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={async () => {
                            const { error } = await supabase.from("pricing").delete().eq("id", p.id);
                            if (error) { toast.error(error.message); return; }
                            toast.success("Pricing deleted");
                            qc.invalidateQueries({ queryKey: ["pricing"] });
                          }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
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

function PricingDialog({ editing, userId, onClose }: { editing: Pricing | null; userId: string; onClose: () => void }) {
  const [unitType, setUnitType] = useState(editing?.unit_type ?? "");
  const [monthlyRent, setMonthlyRent] = useState(editing?.monthly_rent?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!unitType) { toast.error("Select a unit type"); return; }
    const amount = parseFloat(monthlyRent);
    if (isNaN(amount) || amount < 0) { toast.error("Enter a valid monthly rent"); return; }

    setBusy(true);
    const payload = { unit_type: unitType, monthly_rent: amount, created_by: userId };
    const { error } = editing
      ? await supabase.from("pricing").update({ monthly_rent: amount }).eq("id", editing.id)
      : await supabase.from("pricing").upsert(payload, { onConflict: "unit_type,created_by" });
    setBusy(false);

    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Pricing updated" : "Pricing created");
    onClose();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.unit_type} pricing` : "Add Pricing"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Unit type</Label>
          <Select value={unitType} onValueChange={setUnitType} disabled={!!editing}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {UNIT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Monthly rent (₹)</Label>
          <Input
            type="number"
            min={0}
            step={100}
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(e.target.value)}
            placeholder="e.g. 5000"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy} className="bg-primary hover:bg-primary/90">
          {busy ? "Saving…" : editing ? "Save changes" : "Create pricing"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
