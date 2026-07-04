import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Shield, Pencil, Trash2 } from "lucide-react";

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

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // Response is not JSON (e.g., HTML error page from an uncaught server exception)
  }

  if (!res.ok) {
    const message = json?.error?.message || `Request failed with status ${res.status}`;
    throw new Error(message);
  }
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
  const [editTarget, setEditTarget] = useState<OwnerRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OwnerRow | null>(null);

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
          <p className="text-sm text-muted-foreground">
            {owners.length} residential owner{owners.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-1 h-4 w-4" />
              Create Owner
            </Button>
          </DialogTrigger>
          <CreateOwnerDialog
            onClose={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["owners"] });
            }}
          />
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
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{o.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.full_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        <Shield className="h-3 w-3" />
                        {o.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget(o)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(o)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <EditOwnerDialog
        owner={editTarget}
        onClose={() => {
          setEditTarget(null);
          if (editTarget) qc.invalidateQueries({ queryKey: ["owners"] });
        }}
      />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Owner</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete owner{" "}
            <strong>{deleteTarget?.email}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await apiFetch("/api/auth/delete-user", { user_id: deleteTarget.id });
                  toast.success("Owner deleted");
                  qc.invalidateQueries({ queryKey: ["owners"] });
                } catch (err: any) {
                  toast.error(err.message);
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditOwnerDialog({
  owner,
  onClose,
}: {
  owner: OwnerRow | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(owner?.full_name ?? "");
  const [email, setEmail] = useState(owner?.email ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(owner?.full_name ?? "");
    setEmail(owner?.email ?? "");
  }, [owner]);

  async function save() {
    if (!owner) return;
    setBusy(true);
    try {
      await apiFetch("/api/auth/update-user", { user_id: owner.id, email: email.trim() || null, name: name.trim() || null });
      toast.success("Owner updated");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!owner} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Owner</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Owner name"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy} className="bg-primary hover:bg-primary/90">
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="owner@example.com"
            type="email"
          />
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <Input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            type="password"
            placeholder="Min 6 characters"
          />
        </div>
        <div className="space-y-2">
          <Label>Name (optional)</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Owner name"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy} className="bg-primary hover:bg-primary/90">
          {busy ? "Creating…" : "Create Owner"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
