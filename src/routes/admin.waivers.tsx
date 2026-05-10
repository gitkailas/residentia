import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { inr, formatDate } from "@/lib/format";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/waivers")({ component: WaiversPage });

function WaiversPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "Pending Approval" | "Approved" | "Rejected">("all");

  const { data: waivers = [], isLoading } = useQuery({
    queryKey: ["waivers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("waivers")
        .select("*, units(unit_no, owner_name, type)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () => (tab === "all" ? waivers : waivers.filter((w: any) => w.status === tab)),
    [waivers, tab]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Waivers</h1>
          <p className="text-sm text-muted-foreground">Manual waivers granted to specific units.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90"><Plus className="mr-1 h-4 w-4" />New Waiver</Button>
          </DialogTrigger>
          <NewWaiverDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["waivers"] }); }} />
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "Pending Approval", "Approved", "Rejected"] as const).map((t) => (
          <Button key={t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)}>
            {t === "all" ? "All" : t}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No waivers.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Unit</th><th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Original</th>
                  <th className="px-4 py-3 text-right">Waiver</th>
                  <th className="px-4 py-3 text-right">Final</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w: any) => (
                  <WaiverRow key={w.id} w={w} onChange={() => qc.invalidateQueries({ queryKey: ["waivers"] })} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function WaiverRow({ w, onChange }: { w: any; onChange: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  async function decide(status: "Approved" | "Rejected") {
    setBusy(true);
    const { error } = await supabase.from("waivers").update({
      status, approved_by: user?.email ?? null, approved_at: new Date().toISOString(),
    }).eq("id", w.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Waiver ${status.toLowerCase()}`);
    onChange();
  }

  return (
    <tr className="border-t">
      <td className="px-4 py-3 font-semibold">{w.units?.unit_no}<div className="text-xs font-normal text-muted-foreground">{w.units?.owner_name}</div></td>
      <td className="px-4 py-3">{w.waiver_type}</td>
      <td className="px-4 py-3 max-w-xs"><div className="line-clamp-2">{w.reason}</div></td>
      <td className="px-4 py-3 text-right">{inr(w.original_amount)}</td>
      <td className="px-4 py-3 text-right text-status-waiver">−{inr(w.waiver_amount)}</td>
      <td className="px-4 py-3 text-right font-semibold">{inr(w.final_amount)}</td>
      <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
      <td className="px-4 py-3 text-xs">{formatDate(w.created_at)}</td>
      <td className="px-4 py-3 text-right">
        {w.status === "Pending Approval" && (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => decide("Approved")} className="text-status-paid">
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => decide("Rejected")} className="text-status-unpaid">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function NewWaiverDialog({ onClose }: { onClose: () => void }) {
  const { data: units = [] } = useQuery({
    queryKey: ["units-min"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id, unit_no, owner_name").order("floor").order("unit_no");
      return data ?? [];
    },
  });

  const [unitId, setUnitId] = useState("");
  const [waiverType, setWaiverType] = useState("Manual");
  const [original, setOriginal] = useState(0);
  const [waiver, setWaiver] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const final = Math.max(original - waiver, 0);

  async function save() {
    if (!unitId) { toast.error("Pick a unit"); return; }
    setBusy(true);
    const { error } = await supabase.from("waivers").insert({
      unit_id: unitId, waiver_type: waiverType,
      original_amount: original, waiver_amount: waiver, final_amount: final,
      reason, status: "Pending Approval",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Waiver request created");
    onClose();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New waiver request</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Unit</Label>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.unit_no} — {u.owner_name ?? "—"}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Waiver type</Label>
          <Select value={waiverType} onValueChange={setWaiverType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Manual", "Hardship", "Goodwill", "Discount", "Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Original amount</Label>
            <Input type="number" value={original} onChange={(e) => setOriginal(Number(e.target.value))} />
          </div>
          <div className="space-y-2"><Label>Waiver amount</Label>
            <Input type="number" value={waiver} onChange={(e) => setWaiver(Number(e.target.value))} />
          </div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">Final payable: <strong>{inr(final)}</strong></div>
        <div className="space-y-2">
          <Label>Reason</Label>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy} className="bg-primary hover:bg-primary/90">
          {busy ? "Saving…" : "Create request"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
