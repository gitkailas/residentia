import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold text-gold-foreground shadow-sm">
        <Building2 className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className="text-base font-bold tracking-tight">Residentia</div>
        {!compact && (
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            RWA Malabar Red Orchids
          </div>
        )}
      </div>
    </div>
  );
}
