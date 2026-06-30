import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Shield } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

const AUTH_TOKEN_KEY = "residentia_token";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
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

interface OwnerRow {
  id: string;
  email: string;
  role: string;
  created_at: string;
  full_name: string | null;
}

function UsersPage() {
  const { role, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  if (!loading && role !== "master_admin") {
    nav({ to: "/admin/dashboard" });
    return null;
  }

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["owners"],
    queryFn: async () => {
      const res = await apiFetch("/api/auth/list-users", { role: "owner" });
      return (res?.data ?? []) as OwnerRow[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Manage Owners</h1>
          <p className="text-sm text-muted-foreground">{owners.length} residential owner{owners.length !== 1 ? "s" : ""}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90"><Plus className="mr-1 h-4 w-4" />Create Owner</Button>
          </DialogTrigger>
          <CreateOwnerDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["owners"] }); }} />
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : owners.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No owners yet. Click <span className="font-semibold">Create Owner</span> to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{o.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.full_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        <Shield className="h-3 w-3" />{o.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.created_at)}</td>
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

function CreateOwnerDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.email.trim() || !form.password.trim()) {
      toast.error("Email and password are required");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/auth/create-user", {
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim() || undefined,
        role: "owner",
      });
      toast.success("Owner account created");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Create Residential Owner</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@example.com" type="email" />
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" placeholder="Min 6 characters" />
        </div>
        <div className="space-y-2">
          <Label>Name (optional)</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Owner name" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy} className="bg-primary hover:bg-primary/90">
          {busy ? "Creating…" : "Create Owner"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
