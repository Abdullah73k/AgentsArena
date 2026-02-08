/**
 * Chronological timeline of all agent actions during the test.
 */

import { useRef, useEffect, memo } from "react";
import { RiTimeLine, RiCheckLine, RiCloseLine } from "@remixicon/react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { AgentAction } from "@/hooks/use-test-websocket";

function ActionTimelineInner({ actions }: { actions: AgentAction[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [actions.length]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RiTimeLine className="size-4 text-primary" />
          Action Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <EmptyState
            icon={RiTimeLine}
            title="No actions yet"
            description="Agent actions will be logged here as they happen"
          />
        ) : (
          <div
            ref={scrollRef}
            className="max-h-[240px] overflow-y-auto"
          >
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted-foreground text-left text-[10px]">
                  <th className="py-1 pr-2 font-medium">Time</th>
                  <th className="py-1 pr-2 font-medium">Source</th>
                  <th className="py-1 pr-2 font-medium">Action</th>
                  <th className="py-1 pr-2 font-medium">Detail</th>
                  <th className="py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((action, i) => (
                  <tr
                    key={`${action.timestamp}-${i}`}
                    className="border-t border-border/50"
                  >
                    <td className="py-1.5 pr-2 tabular-nums text-muted-foreground text-[10px]">
                      {formatTime(action.timestamp)}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          action.sourceType === "target"
                            ? "text-primary"
                            : "text-amber-500"
                        )}
                      >
                        {action.sourceType === "target" ? "TARGET" : "AGENT"}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 font-mono text-[10px]">
                      {action.actionType}
                    </td>
                    <td className="py-1.5 pr-2 max-w-[200px] truncate text-muted-foreground">
                      {action.actionDetail}
                    </td>
                    <td className="py-1.5">
                      {action.success ? (
                        <RiCheckLine className="size-3 text-emerald-500" />
                      ) : (
                        <RiCloseLine className="size-3 text-destructive" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ActionTimeline = memo(ActionTimelineInner);

export { ActionTimeline };
