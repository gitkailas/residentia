import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/queries")({ component: QueriesPage });

function QueriesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "Open" | "Resolved">("Open");

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["admin-queries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("queries")
        .select("*, units(unit_no, owner_name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () => (tab === "all" ? list : list.filter((q: any) => q.status === tab)),
    [list, tab]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Resident Queries</h1>
        <p className="text-sm text-muted-foreground">Reply to and resolve resident-submitted issues.</p>
      </div>

      <div className="flex gap-2">
        {(["Open", "Resolved", "all"] as const).map((t) => (
          <Button key={t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)}>
            {t === "all" ? "All" : t}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">No queries.</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((q: any) => (
            <QueryCard key={q.id} q={q} onChange={() => qc.invalidateQueries({ queryKey: ["admin-queries"] })} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueryCard({ q, onChange }: { q: any; onChange: () => void }) {
  const [reply, setReply] = useState(q.admin_reply ?? "");
  const [busy, setBusy] = useState(false);

  async function save(status: string) {
    setBusy(true);
    const { error } = await supabase.from("queries").update({ admin_reply: reply, status }).eq("id", q.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    onChange();
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{q.subject}</div>
          <div className="text-xs text-muted-foreground">
            Unit {q.units?.unit_no ?? "—"} · {q.units?.owner_name ?? ""} · {formatDate(q.created_at)}
          </div>
        </div>
        <StatusBadge status={q.status} />
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/80">{q.description}</p>
      <div className="mt-4 space-y-2">
        <div className="text-xs uppercase text-muted-foreground">Admin reply</div>
        <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your response…" />
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => save("Open")} variant="outline">Save reply</Button>
          <Button size="sm" disabled={busy} onClick={() => save("Resolved")} className="bg-status-paid hover:bg-status-paid/90">
            Mark resolved
          </Button>
        </div>
      </div>
    </Card>
  );
}
