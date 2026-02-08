/**
 * Pulsing "LIVE" dot indicator for active/streaming states.
 *
 * Shows a small colored dot with an animated ping ring and optional label.
 */

import { cn } from "@/lib/utils";

function LiveIndicator({
  className,
  label = "LIVE",
  active = true,
  ...props
}: React.ComponentProps<"span"> & {
  label?: string;
  active?: boolean;
}) {
  return (
    <span
      data-slot="live-indicator"
      data-active={active}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        active ? "text-emerald-500" : "text-muted-foreground",
        className
      )}
      {...props}
    >
      <span className="relative flex size-2">
        {active && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            active ? "bg-emerald-500" : "bg-muted-foreground/50"
          )}
        />
      </span>
      {label}
    </span>
  );
}

export { LiveIndicator };
