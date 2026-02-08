/**
 * Skeleton loading placeholder for async content.
 *
 * Renders a configurable number of animated placeholder rows.
 */

import { cn } from "@/lib/utils";

function SkeletonLine({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-line"
      className={cn(
        "h-3 animate-pulse rounded-none bg-muted",
        className
      )}
      {...props}
    />
  );
}

function LoadingState({
  lines = 3,
  className,
  ...props
}: React.ComponentProps<"div"> & { lines?: number }) {
  return (
    <div
      data-slot="loading-state"
      className={cn("flex flex-col gap-3 p-4", className)}
      {...props}
    >
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine
          key={i}
          className={cn(
            i === 0 && "w-3/4",
            i === lines - 1 && "w-1/2"
          )}
        />
      ))}
    </div>
  );
}

export { LoadingState, SkeletonLine };
