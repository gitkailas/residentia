import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/integrations/db/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/resident/queries")({
  component: QueriesPage,
});

function QueriesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["resident-queries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile } = await db
        .from("profiles")
        .select("unit_id")
        .eq("id", user!.id)
        .maybeSingle();

      let list: any[] = [];
      let unitNo: string | null = null;

      if (profile?.unit_id) {
        const { data: u } = await db
          .from("units")
          .select("unit_no")
          .eq("id", profile.unit_id)
          .single();
        unitNo = u?.unit_no ?? null;

        const { data: q } = await db
          .from("queries")
          .select("*")
          .eq("unit_id", profile.unit_id)
          .order("created_at", { ascending: false });
        list = q ?? [];
      }

      return { queries: list, hasUnit: !!profile?.unit_id, unitNo };
    },
  });

  async function submitQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error("Subject and description are required");
      return;
    }
    setBusy(true);

    const { data: profile } = await db
      .from("profiles")
      .select("unit_id")
      .eq("id", user!.id)
      .maybeSingle();
    if (!profile?.unit_id) {
      toast.error("No unit linked");
      setBusy(false);
      return;
    }

    const { error } = await db.from("queries").insert({
      unit_id: profile.unit_id,
      subject: subject.trim(),
      description: description.trim(),
      status: "Open",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Query submitted");
    setSubject("");
    setDescription("");
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ["resident-queries"] });
  }

  if (isLoading || !data) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Queries</h1>
          <p className="text-sm text-muted-foreground">
            Raise and track issues with the society admin.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-1 h-4 w-4" />
          {showForm ? "Cancel" : "Raise"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={submitQuery} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your issue…"
              />
            </div>
            <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">
              {busy ? "Submitting…" : "Submit Query"}
            </Button>
          </form>
        </Card>
      )}

      {!data.hasUnit ? (
        <Card className="p-6">
          <h2 className="font-semibold">No unit linked</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account isn't linked to a unit yet.
          </p>
        </Card>
      ) : data.queries.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center text-sm text-muted-foreground">
          <MessageSquare className="h-8 w-8" />
          <div>
            No queries yet. Click <span className="font-semibold">Raise</span> to submit one.
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.queries.map((q: any) => (
            <Card key={q.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold">{q.subject}</div>
                <StatusBadge status={q.status} />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{q.description}</p>
              {q.admin_reply && (
                <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Admin reply
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{q.admin_reply}</p>
                </div>
              )}
              <div className="mt-2 text-xs text-muted-foreground">{formatDate(q.created_at)}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
