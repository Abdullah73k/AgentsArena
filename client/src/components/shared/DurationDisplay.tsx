/**
 * Live duration counter that updates every second.
 *
 * Shows elapsed time from a start timestamp, or a fixed duration.
 */

import { useState, useEffect, useRef } from "react";
import { formatDuration, getElapsedSeconds } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

function DurationDisplay({
  startedAt,
  fixedSeconds,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  /** ISO timestamp — if provided, counts up from this time. */
  startedAt?: string | null;
  /** Fixed duration in seconds — displayed as-is. */
  fixedSeconds?: number;
}) {
  const [elapsed, setElapsed] = useState<number>(() => {
    if (fixedSeconds !== undefined) return fixedSeconds;
    if (startedAt) return getElapsedSeconds(startedAt);
    return 0;
  });

  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    // Static display — no ticking needed
    if (fixedSeconds !== undefined || !startedAt) {
      if (fixedSeconds !== undefined) setElapsed(fixedSeconds);
      return;
    }

    // Live counter — tick every second
    setElapsed(getElapsedSeconds(startedAt));
    intervalRef.current = setInterval(() => {
      setElapsed(getElapsedSeconds(startedAt));
    }, 1_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt, fixedSeconds]);

  return (
    <span
      data-slot="duration-display"
      className={cn("tabular-nums text-xs font-mono", className)}
      {...props}
    >
      {formatDuration(elapsed)}
    </span>
  );
}

export { DurationDisplay };
