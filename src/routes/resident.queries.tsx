import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/resident/queries")({
  component: () => (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Raise a query</h2>
      <p className="mt-2 text-sm text-muted-foreground">Coming in the next phase — submit and track queries to society admin.</p>
    </Card>
  ),
});
