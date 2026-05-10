import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/resident/payments")({
  component: () => (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Payment history</h2>
      <p className="mt-2 text-sm text-muted-foreground">Coming in the next phase — full month-by-month history with downloadable receipts.</p>
    </Card>
  ),
});
