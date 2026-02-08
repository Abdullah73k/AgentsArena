/**
 * Displays a behavioral profile as a styled badge with label.
 *
 * Uses PROFILE_INFO for human-readable display names.
 */

import {
  RiUserLine,
  RiUserUnfollowLine,
  RiQuestionLine,
  RiBox3Line,
  RiLogoutBoxLine,
  RiChatVoiceLine,
} from "@remixicon/react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PROFILE_INFO } from "@/lib/utils/colors";
import type { BehavioralProfile } from "@/types/agent";

const PROFILE_ICONS: Record<BehavioralProfile, React.ElementType> = {
  cooperative: RiUserLine,
  "non-cooperator": RiUserUnfollowLine,
  confuser: RiQuestionLine,
  "resource-hoarder": RiBox3Line,
  "task-abandoner": RiLogoutBoxLine,
  "over-communicator": RiChatVoiceLine,
};

function AgentProfileBadge({
  profile,
  className,
  ...props
}: React.ComponentProps<"span"> & { profile: BehavioralProfile }) {
  const info = PROFILE_INFO[profile];
  const Icon = PROFILE_ICONS[profile];

  return (
    <Badge
      data-slot="agent-profile-badge"
      variant="secondary"
      className={cn("gap-1.5", className)}
      {...props}
    >
      <Icon data-icon="inline-start" className="size-3" />
      {info?.label ?? profile}
    </Badge>
  );
}

export { AgentProfileBadge };
