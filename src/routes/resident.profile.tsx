import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/integrations/db/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Building2, Phone, Mail } from "lucide-react";

export const Route = createFileRoute("/resident/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["resident-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile } = await db
        .from("profiles")
        .select("full_name, email, phone, unit_id")
        .eq("id", user!.id)
        .maybeSingle();

      let unit: any = null;
      if (profile?.unit_id) {
        const { data: u } = await db
          .from("units")
          .select("unit_no, floor, type, owner_name")
          .eq("id", profile.unit_id)
          .single();
        unit = u;
      }

      return {
        fullName: profile?.full_name ?? user?.email ?? "—",
        email: profile?.email ?? user?.email ?? "—",
        phone: profile?.phone ?? "",
        unit,
        hasUnit: !!profile?.unit_id,
      };
    },
  });

  async function savePhone() {
    if (!user) return;
    setBusy(true);
    const { error } = await db.from("profiles").update({ phone }).eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Phone number updated");
  }

  if (isLoading || !data) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account and unit details.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="text-lg font-bold">{data.fullName}</div>
            <div className="text-sm text-muted-foreground">{data.email}</div>
          </div>
        </div>
      </Card>

      {data.hasUnit && data.unit && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Unit Details
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Unit No.</div>
              <div className="font-semibold">{data.unit.unit_no}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Floor</div>
              <div className="font-semibold">{data.unit.floor}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Type</div>
              <div className="font-semibold">{data.unit.type}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Owner</div>
              <div className="font-semibold">{data.unit.owner_name ?? "—"}</div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Phone className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Contact Info
          </h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{data.email}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex gap-2">
              <Input
                id="phone"
                value={phone || data.phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
              />
              <Button
                onClick={savePhone}
                disabled={busy || !phone}
                className="bg-primary hover:bg-primary/90 shrink-0"
              >
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {!data.hasUnit && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Your account isn't linked to a unit yet. Contact your society admin.
          </p>
        </Card>
      )}
    </div>
  );
}
