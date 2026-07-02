import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { Plus, Search, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

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
  owner_phone: string | null;
  owner_user_id: string | null;
  registration_date: string | null;
  key_handover_date: string | null;
  waiver_start_date: string | null;
  waiver_end_date: string | null;
  billing_enabled: boolean;
  property_name: string | null;
  description: string | null;
  area_sqft: number | null;
  monthly_rent: number;
}

function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("residentia_token");
}

async function apiFetch(path: string, body: unknown) {
  const token = getToken();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? res.statusText);
  return json;
}

function UnitsPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isOwner = role === "owner";
  const { data: units = [], isLoading } = useQuery({
    queryKey: ["units", isOwner ? user?.id : "all"],
    queryFn: async () => {
      let query = supabase.from("units").select("*").order("floor").order("unit_no");
      if (isOwner && user?.id) {
        query = query.eq("owner_user_id", user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Unit[];
    },
    enabled: !!user,
  });

  const vacantUnits = useMemo(() => units.filter((u) => !u.owner_name), [units]);

  const [search, setSearch] = useState("");
  const [floor, setFloor] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ unitId: string; unitNo: string } | null>(null);

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

  async function handleDeleteTenant(unitId: string) {
    try {
      const res = await apiFetch("/api/auth/delete-tenant", { unit_id: unitId });
      if (res?.error) throw new Error(res.error.message);
      toast.success("Tenant deleted");
      qc.invalidateQueries({ queryKey: ["units"] });
    } catch (err: any) {
      toast.error(err.message);
    }
    setDeleteConfirm(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Units & Tenants</h1>
          <p className="text-sm text-muted-foreground">{units.length} {role === "owner" ? "assigned" : ""} units · 14 floors</p>
        </div>
        <div className="flex gap-2">
          {!isOwner && <ImportCsvButton onDone={() => qc.invalidateQueries({ queryKey: ["units"] })} />}
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90" disabled={isOwner && vacantUnits.length === 0} title={isOwner && vacantUnits.length === 0 ? "No vacant properties. Add a property in Properties first." : ""}>
                <Plus className="mr-1 h-4 w-4" />{isOwner ? "Assign Tenant" : "Add Unit"}
              </Button>
            </DialogTrigger>
            {isOwner ? (
              <AssignTenantDialog
                key={editing?.id ?? "new"}
                vacantUnits={vacantUnits}
                onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["units"] }); }}
              />
            ) : (
              <UnitDialog
                key={editing?.id ?? "new"}
                editing={editing}
                userId={undefined}
                onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["units"] }); }}
              />
            )}
          </Dialog>
        </div>
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
              <SelectItem value="1BHK">1BHK</SelectItem>
              <SelectItem value="2BHK">2BHK</SelectItem>
              <SelectItem value="3BHK">3BHK</SelectItem>
              <SelectItem value="4BHK">4BHK</SelectItem>
              <SelectItem value="5BHK">5BHK</SelectItem>
              <SelectItem value="6BHK">6BHK</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {isOwner
              ? "No properties yet. Add a property in the Properties section first."
              : "No units yet. Click \"Add Unit\" to get started."
            }
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Floor</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Tenant Name</th>
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
                      <StatusBadge status={!u.owner_name ? "Vacant" : u.billing_enabled ? "Active" : "Waiver Period"} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(u); setOpen(true); }}>Edit</Button>
                      {u.owner_name && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ unitId: u.id, unitNo: u.unit_no })}>
                          <Trash2 className="mr-1 h-3 w-3" />Delete
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Tenant</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the tenant from unit <strong>{deleteConfirm?.unitNo}</strong>?
            This will permanently remove the tenant's login access and profile.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDeleteTenant(deleteConfirm.unitId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UnitDialog({ editing, onClose, userId }: { editing: Unit | null; onClose: () => void; userId?: string }) {
  const [form, setForm] = useState({
    unit_no: editing?.unit_no ?? "",
    floor: editing?.floor ?? 1,
    type: editing?.type ?? "2BHK",
    status: editing?.status ?? "sold",
    owner_name: editing?.owner_name ?? "",
    owner_phone: editing?.owner_phone ?? "",
    registration_date: editing?.registration_date ?? "",
    key_handover_date: editing?.key_handover_date ?? "",
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const billing_enabled = form.status === "sold" && !!form.key_handover_date;
    const payload: Record<string, unknown> = {
      unit_no: form.unit_no.trim(),
      floor: Number(form.floor),
      type: form.type,
      status: form.status,
      owner_name: form.owner_name || null,
      owner_phone: form.owner_phone || null,
      registration_date: form.registration_date || null,
      key_handover_date: form.key_handover_date || null,
      billing_enabled,
      ...(userId ? { owner_user_id: userId } : {}),
    };

    if (editing) {
      const { error } = await supabase.from("units").update(payload).eq("id", editing.id);
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Unit updated");
      onClose();
      return;
    }

    const { data: newUnits, error } = await supabase.from("units").insert(payload).select();
    setBusy(false);
    if (error) { toast.error(error.message); return; }

    const unitId = (newUnits as Unit[])?.[0]?.id;
    if (unitId && form.owner_phone) {
      try {
        await apiFetch("/api/auth/create-tenant", {
          email: form.owner_phone.trim(),
          password: form.owner_phone.trim(),
          name: form.owner_name || null,
          phone: form.owner_phone.trim(),
          unit_id: unitId,
        });
        toast.success("Unit created and tenant login set up");
      } catch (e) {
        toast.error(`Unit created but tenant account failed: ${(e as Error).message}`);
      }
      onClose();
      return;
    }

    toast.success("Unit created");
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
          <Input type="number" min={0} max={14} value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1BHK">1BHK</SelectItem>
              <SelectItem value="2BHK">2BHK</SelectItem>
              <SelectItem value="3BHK">3BHK</SelectItem>
              <SelectItem value="4BHK">4BHK</SelectItem>
              <SelectItem value="5BHK">5BHK</SelectItem>
              <SelectItem value="6BHK">6BHK</SelectItem>
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
          <Label>Tenant name</Label>
          <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Tenant mobile number</Label>
          <Input value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} placeholder="e.g. 9876543210" />
          <p className="text-xs text-muted-foreground">Tenant will use this number as both username and password to log in.</p>
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

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy} className="bg-primary hover:bg-primary/90">
          {busy ? "Saving…" : editing ? "Save changes" : "Create unit"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AssignTenantDialog({ vacantUnits, onClose }: { vacantUnits: Unit[]; onClose: () => void }) {
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [form, setForm] = useState({
    owner_name: "",
    owner_phone: "",
    registration_date: "",
    key_handover_date: "",
  });
  const [busy, setBusy] = useState(false);

  const selectedUnit = vacantUnits.find((u) => u.id === selectedUnitId);

  async function save() {
    if (!selectedUnitId) { toast.error("Select a vacant property"); return; }
    if (!form.owner_name.trim()) { toast.error("Enter tenant name"); return; }
    if (!form.owner_phone.trim()) { toast.error("Enter tenant mobile number"); return; }

    setBusy(true);
    const billing_enabled = !!form.key_handover_date;
    const { error: updateError } = await supabase.from("units").update({
      owner_name: form.owner_name.trim(),
      owner_phone: form.owner_phone.trim(),
      status: "sold",
      registration_date: form.registration_date || null,
      key_handover_date: form.key_handover_date || null,
      billing_enabled,
    }).eq("id", selectedUnitId);
    if (updateError) { setBusy(false); toast.error(updateError.message); return; }

    try {
      await apiFetch("/api/auth/create-tenant", {
        email: form.owner_phone.trim(),
        password: form.owner_phone.trim(),
        name: form.owner_name.trim(),
        phone: form.owner_phone.trim(),
        unit_id: selectedUnitId,
      });
      toast.success("Tenant assigned successfully");
    } catch (e) {
      toast.error(`Unit updated but tenant account failed: ${(e as Error).message}`);
    }
    setBusy(false);
    onClose();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Assign Tenant</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Select vacant property</Label>
          <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
            <SelectTrigger><SelectValue placeholder="Choose a property" /></SelectTrigger>
            <SelectContent>
              {vacantUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.unit_no}{u.property_name ? ` — ${u.property_name}` : ""} ({u.type}, Floor {u.floor})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedUnit && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Monthly rent</span><span className="font-semibold">₹{selectedUnit.monthly_rent.toLocaleString("en-IN")}</span></div>
            {selectedUnit.area_sqft && <div className="flex justify-between"><span className="text-muted-foreground">Area</span><span>{selectedUnit.area_sqft} sq.ft</span></div>}
          </div>
        )}

        <div className="space-y-2">
          <Label>Tenant name</Label>
          <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Full name" />
        </div>
        <div className="space-y-2">
          <Label>Tenant mobile number</Label>
          <Input value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} placeholder="e.g. 9876543210" />
          <p className="text-xs text-muted-foreground">Tenant will use this number as both username and password to log in.</p>
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

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy} className="bg-primary hover:bg-primary/90">
          {busy ? "Assigning…" : "Assign Tenant"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ImportCsvButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const parsed = (res.data as any[]).map((r) => ({
          unit_no: String(r.unit_no ?? r.Unit ?? r.unit ?? "").trim(),
          floor: Number(r.floor ?? r.Floor ?? 0),
          type: String(r.type ?? r.Type ?? "2BHK").trim(),
          status: String(r.status ?? r.Status ?? "sold").trim(),
          owner_name: r.owner_name ?? r.Owner ?? r.owner ?? null,
          registration_date: r.registration_date || null,
          key_handover_date: r.key_handover_date || null,
        })).filter((r) => r.unit_no && r.floor > 0);
        setRows(parsed);
        setOpen(true);
      },
      error: (err) => toast.error(err.message),
    });
    e.target.value = "";
  }

  async function importAll() {
    if (!rows.length) return;
    setBusy(true);
    const { error } = await supabase.from("units").upsert(rows, { onConflict: "unit_no" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${rows.length} units`);
    setOpen(false); setRows([]); setFileName("");
    onDone();
  }

  return (
    <>
      <Label className="cursor-pointer">
        <input type="file" accept=".csv" className="hidden" onChange={pick} />
        <span className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted">
          <Upload className="mr-2 h-4 w-4" />Import CSV
        </span>
      </Label>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import preview — {fileName}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Expected columns: <code>unit_no, floor, type, status, owner_name, registration_date, key_handover_date</code>.
            Existing units (matched by unit_no) will be updated.
          </p>
          <div className="max-h-80 overflow-auto rounded border text-xs">
            <table className="w-full">
              <thead className="bg-muted/50"><tr>
                <th className="p-2 text-left">Unit</th><th className="p-2">Floor</th><th className="p-2">Type</th>
                <th className="p-2">Tenant Name</th><th className="p-2">Reg.</th><th className="p-2">Handover</th>
              </tr></thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 font-mono">{r.unit_no}</td>
                    <td className="p-2 text-center">{r.floor}</td>
                    <td className="p-2 text-center">{r.type}</td>
                    <td className="p-2">{r.owner_name ?? "—"}</td>
                    <td className="p-2">{r.registration_date ?? "—"}</td>
                    <td className="p-2">{r.key_handover_date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 50 && <p className="text-xs text-muted-foreground">…and {rows.length - 50} more rows</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={importAll} disabled={busy} className="bg-primary hover:bg-primary/90">
              {busy ? "Importing…" : `Import ${rows.length} units`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
