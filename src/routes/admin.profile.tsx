import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { db } from "@/integrations/db/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Mail, Pencil, X, Check } from "lucide-react";

export const Route = createFileRoute("/admin/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isMaster = role === "master_admin";

  const { data, isLoading } = useQuery({
    queryKey: ["admin-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile } = await db
        .from("profiles")
        .select("full_name, email, upi_id")
        .eq("id", user!.id)
        .maybeSingle();

      return {
        fullName: profile?.full_name ?? user?.email ?? "—",
        email: profile?.email ?? user?.email ?? "—",
        upiId: profile?.upi_id ?? "",
      };
    },
  });

  const [upiId, setUpiId] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setUpiId(data.upiId);
      setEditing(!data.upiId);
    }
  }, [data]);

  async function saveUpiId() {
    if (!user) return;
    setSaving(true);
    const { error } = await db
      .from("profiles")
      .update({ upi_id: upiId.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("UPI ID updated");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["admin-profile"] });
  }

  if (isLoading || !data) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account details and payment settings.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="text-lg font-bold">{data.fullName}</div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              {data.email}
            </div>
          </div>
        </div>
      </Card>

      {isMaster ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Master admin accounts manage owners and properties from the admin panel.
          </p>
        </Card>
      ) : (
        <Card className="p-5">
          <Label>UPI ID</Label>
          {editing ? (
            <div className="mt-1.5 space-y-3">
              <div className="flex gap-2">
                <Input
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. owner@paytm"
                  autoFocus
                />
                <Button
                  onClick={saveUpiId}
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 shrink-0"
                >
                  {saving ? (
                    "Saving…"
                  ) : (
                    <>
                      <Check className="mr-1 h-4 w-4" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setUpiId(data.upiId);
                    setEditing(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-1.5 flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
              <span className="font-mono text-sm">
                {data.upiId || <span className="text-muted-foreground italic">Not set</span>}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Tenants will use this UPI ID to pay you directly for all your properties.
          </p>
        </Card>
      )}
    </div>
  );
}
