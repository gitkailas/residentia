import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/announcements")({ component: AnnouncementsPage });

function AnnouncementsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: list = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function post() {
    if (!title.trim() || !message.trim()) { toast.error("Title and message required"); return; }
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({ title, message });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Announcement posted");
    setTitle(""); setMessage("");
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Announcements</h1>
        <p className="text-sm text-muted-foreground">Visible to all residents on their dashboard.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-primary"><Megaphone className="h-5 w-5" /> <strong>Post a new announcement</strong></div>
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Water tank cleaning on Sunday" />
        </div>
        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <Button onClick={post} disabled={busy} className="bg-primary hover:bg-primary/90">
          {busy ? "Posting…" : "Post announcement"}
        </Button>
      </Card>

      <div className="space-y-3">
        {list.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No announcements yet.</Card>
        ) : list.map((a: any) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{a.title}</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{a.message}</div>
                <div className="mt-2 text-xs text-muted-foreground">{formatDate(a.created_at)}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove(a.id)} className="text-status-unpaid">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
