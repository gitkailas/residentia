import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/resident/submit")({
  component: () => (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Submit payment proof</h2>
      <p className="mt-2 text-sm text-muted-foreground">Coming in the next phase — upload UPI/NEFT screenshot for admin verification.</p>
    </Card>
  ),
});
