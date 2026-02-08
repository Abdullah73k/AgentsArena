/**
 * Compact metric display card with label and large value.
 *
 * Used in dashboard metric panels and result summaries.
 */

import { cn } from "@/lib/utils";

function MetricCard({
  label,
  value,
  suffix,
  trend,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div
      data-slot="metric-card"
      className={cn(
        "ring-foreground/10 bg-card rounded-none p-3 ring-1 flex flex-col gap-1",
        className
      )}
      {...props}
    >
      <span className="text-xs text-muted-foreground truncate">{label}</span>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-lg font-semibold tabular-nums tracking-tight",
            trend === "up" && "text-emerald-500",
            trend === "down" && "text-destructive"
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export { MetricCard };
