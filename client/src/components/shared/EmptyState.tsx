/**
 * Empty state placeholder with icon, title, description, and optional action.
 */

import { RiInboxLine } from "@remixicon/react";
import { cn } from "@/lib/utils";

function EmptyState({
  icon: Icon = RiInboxLine,
  title = "Nothing here yet",
  description,
  action,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-center",
        className
      )}
      {...props}
    >
      <Icon className="size-10 text-muted-foreground/40" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-sm">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export { EmptyState };
