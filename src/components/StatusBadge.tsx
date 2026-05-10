import { cn } from "@/lib/utils";

type Status = "PAID" | "UNPAID" | "PARTIAL" | "WAIVER PERIOD" | "ADVANCE PAID" | "PENDING VERIFICATION" | "Active" | "Waiver Period";

const map: Record<string, string> = {
  PAID: "bg-status-paid text-white",
  UNPAID: "bg-status-unpaid text-white",
  PARTIAL: "bg-status-partial text-white",
  "WAIVER PERIOD": "bg-status-waiver text-white",
  "ADVANCE PAID": "bg-status-advance text-white",
  "PENDING VERIFICATION": "bg-muted text-foreground",
  Active: "bg-status-paid text-white",
  "Waiver Period": "bg-status-waiver text-white",
};

export function StatusBadge({ status, className }: { status: Status | string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        map[status] ?? "bg-muted text-foreground",
        className,
      )}
    >
      {status}
    </span>
  );
}
