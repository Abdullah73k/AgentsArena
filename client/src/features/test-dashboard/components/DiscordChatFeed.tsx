/**
 * Chat feed showing Discord/Minecraft messages from the test.
 */

import { useRef, useEffect, memo } from "react";
import { RiChat3Line } from "@remixicon/react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { TestChatMessage } from "@/hooks/use-test-websocket";

function DiscordChatFeedInner({
  messages,
}: {
  messages: TestChatMessage[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RiChat3Line className="size-4 text-primary" />
          Chat Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <EmptyState
            icon={RiChat3Line}
            title="No messages yet"
            description="Discord and Minecraft chat will appear here"
          />
        ) : (
          <div
            ref={scrollRef}
            className="max-h-[260px] space-y-1.5 overflow-y-auto"
          >
            {messages.map((msg, i) => (
              <div
                key={`${msg.timestamp}-${i}`}
                className="flex gap-2 text-xs"
              >
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {formatTime(msg.timestamp)}
                </span>
                <span
                  className={cn(
                    "font-medium shrink-0",
                    msg.sourceType === "target"
                      ? "text-primary"
                      : "text-amber-500"
                  )}
                >
                  [{msg.sourceType === "target" ? "TARGET" : "AGENT"}]
                </span>
                <span className="break-words">{msg.message}</span>
                {msg.channel === "voice" && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    (voice)
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const DiscordChatFeed = memo(DiscordChatFeedInner);

export { DiscordChatFeed };
