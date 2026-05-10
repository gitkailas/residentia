import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/units")({
  component: UnitsPage,
});

interface Unit {
  id: string;
  unit_no: string;
  floor: number;
  type: string;
  status: string;
  owner_name: string | null;
  registration_date: string | null;
  key_handover_date: string | null;
  waiver_start_date: string | null;
  waiver_end_date: string | null;
  billing_enabled: boolean;
}

function computePreview(reg?: string, han?: string) {
  const dates = [reg, han].filter(Boolean) as string[];
  if (!dates.length) return null;
  const start = new Date(Math.min(...dates.map((d) => new Date(d).getTime())));
  const end = new Date(start);
  end.setMonth(end.getMonth() + 6);
  return { start, end };
}

function UnitsPage() {
  const qc = useQueryClient();
  const { data: units = [], isLoading } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").order("floor").order("unit_no");
      if (error) throw error;
      return data as Unit[];
    },
  });

  const [search, setSearch] = useState("");
  const [floor, setFloor] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);

  const filtered = useMemo(() => {
    return units.filter((u) => {
      if (floor !== "all" && String(u.floor) !== floor) return false;
      if (type !== "all" && u.type !== type) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!u.unit_no.toLowerCase().includes(s) && !(u.owner_name ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [units, search, floor, type]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Units & Tenants</h1>
          <p className="text-sm text-muted-foreground">{units.length} units · 14 floors</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90"><Plus className="mr-1 h-4 w-4" />Add Unit</Button>
          </DialogTrigger>
          <UnitDialog
            editing={editing}
            onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["units"] }); }}
          />
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by unit or owner" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={floor} onValueChange={setFloor}>
            <SelectTrigger><SelectValue placeholder="Floor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All floors</SelectItem>
              {Array.from({ length: 14 }).map((_, i) => (
                <SelectItem key={i} value={String(i + 1)}>Floor {i + 1}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="2BHK">2BHK</SelectItem>
              <SelectItem value="3BHK">3BHK</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No units yet. Click <span className="font-semibold">Add Unit</span> to get started.
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
                  <th className="px-4 py-3">Reg.</th>
                  <th className="px-4 py-3">Handover</th>
                  <th className="px-4 py-3">Waiver Ends</th>
                  <th className="px-4 py-3">Billing</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">{u.unit_no}</td>
                    <td className="px-4 py-3">{u.floor}</td>
                    <td className="px-4 py-3">{u.type}</td>
                    <td className="px-4 py-3">{u.owner_name ?? "—"}</td>
                    <td className="px-4 py-3">{formatDate(u.registration_date)}</td>
                    <td className="px-4 py-3">{formatDate(u.key_handover_date)}</td>
                    <td className="px-4 py-3">{formatDate(u.waiver_end_date)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.billing_enabled ? "Active" : "Waiver Period"} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(u); setOpen(true); }}>Edit</Button>
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

function UnitDialog({ editing, onClose }: { editing: Unit | null; onClose: () => void }) {
  const [form, setForm] = useState({
    unit_no: editing?.unit_no ?? "",
    floor: editing?.floor ?? 1,
    type: editing?.type ?? "2BHK",
    status: editing?.status ?? "sold",
    owner_name: editing?.owner_name ?? "",
    registration_date: editing?.registration_date ?? "",
    key_handover_date: editing?.key_handover_date ?? "",
  });
  const [busy, setBusy] = useState(false);

  const preview = computePreview(form.registration_date || undefined, form.key_handover_date || undefined);

  async function save() {
    setBusy(true);
    const payload = {
      unit_no: form.unit_no.trim(),
      floor: Number(form.floor),
      type: form.type,
      status: form.status,
      owner_name: form.owner_name || null,
      registration_date: form.registration_date || null,
      key_handover_date: form.key_handover_date || null,
    };
    const { error } = editing
      ? await supabase.from("units").update(payload).eq("id", editing.id)
      : await supabase.from("units").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Unit updated" : "Unit created");
    onClose();
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editing ? `Edit Unit ${editing.unit_no}` : "Add New Unit"}</DialogTitle>
      </DialogHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Unit number</Label>
          <Input value={form.unit_no} onChange={(e) => setForm({ ...form, unit_no: e.target.value })} placeholder="e.g. 1E" />
        </div>
        <div className="space-y-2">
          <Label>Floor</Label>
          <Input type="number" min={1} max={14} value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2BHK">2BHK</SelectItem>
              <SelectItem value="3BHK">3BHK</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="unsold">Unsold</SelectItem>
              <SelectItem value="vacant">Vacant</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Owner name</Label>
          <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Registration date</Label>
          <Input type="date" value={form.registration_date} onChange={(e) => setForm({ ...form, registration_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Key handover date</Label>
          <Input type="date" value={form.key_handover_date} onChange={(e) => setForm({ ...form, key_handover_date: e.target.value })} />
        </div>
      </div>

      {preview && (
        <div className="rounded-lg border border-status-waiver/30 bg-status-waiver/10 p-3 text-sm">
          <div className="font-medium text-status-waiver">Auto waiver preview</div>
          <div className="mt-1 text-foreground/80">
            Waiver: <strong>{formatDate(preview.start)}</strong> → <strong>{formatDate(preview.end)}</strong>
            <br />
            Billing starts from <strong>{preview.end.toLocaleString("en-IN", { month: "long", year: "numeric" })}</strong>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy} className="bg-primary hover:bg-primary/90">
          {busy ? "Saving…" : editing ? "Save changes" : "Create unit"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
