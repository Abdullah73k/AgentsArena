/**
 * Scrollable feed showing LLM decision events as they arrive.
 */

import { useRef, useEffect, memo } from "react";
import { RiBrainLine } from "@remixicon/react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { TargetLlmDecision } from "@/hooks/use-test-websocket";

function LLMDecisionStreamInner({
  decisions,
}: {
  decisions: TargetLlmDecision[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new decisions
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [decisions.length]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RiBrainLine className="size-4 text-primary" />
          LLM Decisions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {decisions.length === 0 ? (
          <EmptyState
            icon={RiBrainLine}
            title="No decisions yet"
            description="LLM reasoning will stream here during execution"
          />
        ) : (
          <div
            ref={scrollRef}
            className="max-h-[260px] space-y-2 overflow-y-auto"
          >
            {decisions.map((d, i) => (
              <div
                key={`${d.timestamp}-${i}`}
                className="ring-foreground/5 space-y-1 rounded-none p-2 ring-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formatTime(d.timestamp)}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] tabular-nums font-mono",
                      d.responseTimeMs > 5000
                        ? "text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {d.responseTimeMs}ms
                  </span>
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                  {d.responseText.length > 300
                    ? d.responseText.slice(0, 300) + "..."
                    : d.responseText}
                </p>
                {d.parsedActions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {d.parsedActions.map((action, j) => (
                      <span
                        key={j}
                        className="bg-primary/10 text-primary px-1.5 py-0.5 text-[10px]"
                      >
                        {action}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const LLMDecisionStream = memo(LLMDecisionStreamInner);

export { LLMDecisionStream };
