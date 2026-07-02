import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Pencil, Trash2, IndianRupee, Ruler, Search, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/properties")({
  component: PropertiesPage,
});

interface Property {
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

const UNIT_TYPES = ["1BHK", "2BHK", "3BHK", "4BHK", "5BHK", "6BHK"];

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

function PropertiesPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isMaster = role === "master_admin";

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["properties", role === "owner" ? user?.id : "all"],
    queryFn: async () => {
      let query = supabase.from("units").select("*").order("floor").order("unit_no");
      if (role === "owner" && user?.id) {
        query = query.eq("owner_user_id", user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Property[];
    },
    enabled: !!user,
  });

  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ unitId: string; unitNo: string } | null>(null);

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (type !== "all" && p.type !== type) return false;
      if (status !== "all" && p.status !== status) return false;
      if (search) {
        const s = search.toLowerCase();
        const name = p.property_name ?? p.unit_no;
        if (!name.toLowerCase().includes(s) && !p.unit_no.toLowerCase().includes(s) && !(p.owner_name ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [properties, search, type, status]);

  async function handleDelete(unitId: string) {
    try {
      const res = await apiFetch("/api/auth/delete-tenant", { unit_id: unitId });
      if (res?.error) throw new Error(res.error.message);
      toast.success("Property deleted");
      qc.invalidateQueries({ queryKey: ["properties"] });
    } catch (err: any) {
      toast.error(err.message);
    }
    setDeleteConfirm(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Properties</h1>
          <p className="text-sm text-muted-foreground">
            {isMaster
              ? `${properties.length} properties across all owners`
              : `${properties.length} property${properties.length !== 1 ? "ies" : "y"} registered`
            }
          </p>
        </div>
        {!isMaster && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90"><Plus className="mr-1 h-4 w-4" />Add Property</Button>
            </DialogTrigger>
            <PropertyDialog
              key={editing?.id ?? "new"}
              editing={editing}
              userId={user?.id}
              onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["properties"] }); }}
            />
          </Dialog>
        )}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by property name, unit, or tenant" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {UNIT_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="sold">Occupied</SelectItem>
              <SelectItem value="vacant">Vacant</SelectItem>
              <SelectItem value="unsold">Unsold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          {isMaster
            ? "No properties found."
            : "No properties yet. Click Add Property to register one."
          }
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="flex items-start justify-between border-b bg-muted/20 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-semibold">{p.property_name || p.unit_no}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {p.unit_no} · Floor {p.floor}
                  </div>
                </div>
                <StatusBadge status={!p.owner_name ? "Vacant" : p.billing_enabled ? "Active" : "Waiver Period"} />
              </div>

              <div className="space-y-2 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{p.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Monthly Rent</span>
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                    {p.monthly_rent.toLocaleString("en-IN")}
                  </span>
                </div>
                {p.area_sqft && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Area</span>
                    <span className="inline-flex items-center gap-1">
                      <Ruler className="h-3 w-3 text-muted-foreground" />
                      {p.area_sqft.toLocaleString("en-IN")} sq.ft
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="capitalize">{p.status}</span>
                </div>
                {p.owner_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tenant</span>
                    <span>{p.owner_name}</span>
                  </div>
                )}
                {p.description && (
                  <div className="border-t pt-2 text-xs text-muted-foreground">
                    {p.description}
                  </div>
                )}
              </div>

              {!isMaster && (
                <div className="flex border-t">
                  <Button variant="ghost" size="sm" className="flex-1 rounded-none" onClick={() => { setEditing(p); setOpen(true); }}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 rounded-none text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ unitId: p.id, unitNo: p.unit_no })}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the property <strong>{deleteConfirm?.unitNo}</strong>?
            This will permanently remove the tenant's login access and profile.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm.unitId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PropertyDialog({ editing, userId, onClose }: { editing: Property | null; userId?: string; onClose: () => void }) {
  const [form, setForm] = useState({
    property_name: editing?.property_name ?? "",
    unit_no: editing?.unit_no ?? "",
    floor: editing?.floor ?? 1,
    type: editing?.type ?? "2BHK",
    monthly_rent: editing?.monthly_rent?.toString() ?? "",
    status: editing?.status ?? "vacant",
    description: editing?.description ?? "",
    area_sqft: editing?.area_sqft?.toString() ?? "",
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const payload: Record<string, unknown> = {
      property_name: form.property_name.trim() || null,
      unit_no: form.unit_no.trim(),
      floor: Number(form.floor),
      type: form.type,
      monthly_rent: parseFloat(form.monthly_rent) || 0,
      status: form.status,
      description: form.description.trim() || null,
      area_sqft: form.area_sqft ? parseInt(form.area_sqft) : null,
      billing_enabled: false,
      ...(userId ? { owner_user_id: userId } : {}),
    };

    if (editing) {
      const { error } = await supabase.from("units").update(payload).eq("id", editing.id);
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Property updated");
      onClose();
      return;
    }

    const { error } = await supabase.from("units").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }

    toast.success("Property created");
    onClose();
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.property_name || editing.unit_no}` : "Add New Property"}</DialogTitle>
      </DialogHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>Property name</Label>
          <Input value={form.property_name} onChange={(e) => setForm({ ...form, property_name: e.target.value })} placeholder="e.g. My Ocean View Apartment" />
        </div>
        <div className="space-y-2">
          <Label>Unit number</Label>
          <Input value={form.unit_no} onChange={(e) => setForm({ ...form, unit_no: e.target.value })} placeholder="e.g. C101" />
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
              {UNIT_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Monthly rent (₹)</Label>
          <Input type="number" min={0} step={100} value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} placeholder="e.g. 15000" />
        </div>
        <div className="space-y-2">
          <Label>Area (sq.ft)</Label>
          <Input type="number" min={0} value={form.area_sqft} onChange={(e) => setForm({ ...form, area_sqft: e.target.value })} placeholder="e.g. 1200" />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sold">Occupied</SelectItem>
              <SelectItem value="vacant">Vacant</SelectItem>
              <SelectItem value="unsold">Unsold</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Description</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the property" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy} className="bg-primary hover:bg-primary/90">
          {busy ? "Saving…" : editing ? "Save changes" : "Create property"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
