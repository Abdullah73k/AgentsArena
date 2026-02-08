/**
 * Step 5: Review & Create
 *
 * Summary of all wizard selections with a submit button.
 */

import { useFormContext } from "react-hook-form";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AgentProfileBadge } from "@/components/shared/AgentProfileBadge";
import { LLM_MODELS } from "@/lib/utils/constants";
import { formatDuration } from "@/lib/utils/format";
import type { CreateTestFormData } from "@/lib/schemas/test.schemas";

function ReviewRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-muted-foreground text-xs shrink-0">{label}</span>
      <span className="text-xs text-right">{children}</span>
    </div>
  );
}

function ReviewAndCreate() {
  const { watch } = useFormContext<CreateTestFormData>();
  const values = watch();

  const model = LLM_MODELS.find((m) => m.id === values.targetLlmModel);
  const mc = values.config?.minecraftServer;
  const hasPromptOverride =
    values.config?.targetLlmSystemPromptOverride &&
    values.config.targetLlmSystemPromptOverride.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Review Configuration</h3>
        <p className="text-xs text-muted-foreground">
          Verify your test settings before creating the test run.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scenario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <ReviewRow label="Type">{values.scenarioType}</ReviewRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Target LLM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <ReviewRow label="Model">
            {model ? `${model.name} (${model.provider})` : values.targetLlmModel}
          </ReviewRow>
          <ReviewRow label="System Prompt">
            {hasPromptOverride ? "Custom override" : "Scenario default"}
          </ReviewRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testing Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {values.testingAgentProfiles?.map((profile) => (
              <AgentProfileBadge key={profile} profile={profile} />
            ))}
          </div>
          <Separator className="my-2" />
          <ReviewRow label="Behavior Intensity">
            {Math.round((values.config?.behaviorIntensity ?? 0.5) * 100)}%
          </ReviewRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Minecraft &amp; Timing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <ReviewRow label="Server">
            {mc ? `${mc.host}:${mc.port} (v${mc.version})` : "Default"}
          </ReviewRow>
          <ReviewRow label="Duration">
            {formatDuration(values.durationSeconds ?? 300)}
          </ReviewRow>
          <ReviewRow label="Polling Interval">
            {((values.config?.llmPollingIntervalMs ?? 7000) / 1000).toFixed(1)}s
          </ReviewRow>
          <ReviewRow label="Text Chat">
            {values.config?.enableText ? "Enabled" : "Disabled"}
          </ReviewRow>
          <ReviewRow label="Voice">
            {values.config?.enableVoice ? "Enabled" : "Disabled"}
          </ReviewRow>
        </CardContent>
      </Card>
    </div>
  );
}

export { ReviewAndCreate };
