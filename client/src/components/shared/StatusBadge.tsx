/**
 * Color-coded status badge for TestRunStatus, AgentStatus, or BotStatus.
 *
 * Wraps the base Badge with automatic color resolution based on status type.
 */

import type { VariantProps } from "class-variance-authority";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatusColor } from "@/lib/utils/colors";
import {
  getTestStatusColor,
  getAgentStatusColor,
  getBotStatusColor,
} from "@/lib/utils/colors";
import type { TestRunStatus } from "@/types/test";
import type { AgentStatus } from "@/types/agent";
import type { BotStatus } from "@/types/bot";

type StatusDomain = "test" | "agent" | "bot";

type StatusBadgeProps = Omit<
  React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>,
  "variant"
> & (
  | { domain: "test"; status: TestRunStatus }
  | { domain: "agent"; status: AgentStatus }
  | { domain: "bot"; status: BotStatus }
);

function resolveColor(domain: StatusDomain, status: string): StatusColor {
  switch (domain) {
    case "test":
      return getTestStatusColor(status as TestRunStatus);
    case "agent":
      return getAgentStatusColor(status as AgentStatus);
    case "bot":
      return getBotStatusColor(status as BotStatus);
  }
}

function StatusBadge({ domain, status, className, ...props }: StatusBadgeProps) {
  const variant = resolveColor(domain, status);

  return (
    <Badge
      data-slot="status-badge"
      variant={variant}
      className={cn("uppercase tracking-wide", className)}
      {...props}
    >
      {status}
    </Badge>
  );
}

export { StatusBadge };
