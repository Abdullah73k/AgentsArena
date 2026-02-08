/**
 * Step 3: Agent Profiles
 *
 * Select which behavioral profiles to use as testing agents.
 * Toggle profiles on/off and adjust the global behavior intensity.
 */

import { useFormContext, Controller } from "react-hook-form";

import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { PROFILE_INFO } from "@/lib/utils/colors";
import { AgentProfileBadge } from "@/components/shared/AgentProfileBadge";
import type { BehavioralProfile } from "@/types/agent";
import type { CreateTestFormData } from "@/lib/schemas/test.schemas";

const ALL_PROFILES: BehavioralProfile[] = [
  "cooperative",
  "non-cooperator",
  "confuser",
  "resource-hoarder",
  "task-abandoner",
  "over-communicator",
];

function AgentProfiles() {
  const {
    control,
    formState: { errors },
  } = useFormContext<CreateTestFormData>();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Testing Agent Profiles</h3>
        <p className="text-xs text-muted-foreground">
          Select the behavioral archetypes that will interact with the target LLM.
          Choose 1-5 profiles.
        </p>
      </div>

      <Controller
        name="testingAgentProfiles"
        control={control}
        render={({ field }) => {
          const selected = field.value ?? [];

          function toggle(profile: BehavioralProfile) {
            const current = [...selected];
            const idx = current.indexOf(profile);
            if (idx >= 0) {
              current.splice(idx, 1);
            } else if (current.length < 5) {
              current.push(profile);
            }
            field.onChange(current);
          }

          return (
            <Field>
              <FieldLabel>Profiles</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {ALL_PROFILES.map((profile) => {
                  const info = PROFILE_INFO[profile];
                  const isSelected = selected.includes(profile);

                  return (
                    <button
                      key={profile}
                      type="button"
                      onClick={() => toggle(profile)}
                      className={cn(
                        "ring-foreground/10 flex items-start gap-3 rounded-none p-3 text-left text-xs ring-1 transition-colors hover:bg-muted/50",
                        isSelected && "ring-primary ring-2 bg-primary/5"
                      )}
                    >
                      <div className="flex-1 space-y-1">
                        <AgentProfileBadge profile={profile} />
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          {info?.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {errors.testingAgentProfiles && (
                <FieldError>{errors.testingAgentProfiles.message}</FieldError>
              )}
            </Field>
          );
        }}
      />

      <Controller
        name="config.behaviorIntensity"
        control={control}
        render={({ field }) => (
          <Field>
            <FieldLabel>
              Behavior Intensity: {Math.round((field.value ?? 0.5) * 100)}%
            </FieldLabel>
            <FieldDescription>
              Controls how aggressively testing agents follow their behavioral
              profiles. Higher values produce more extreme behaviors.
            </FieldDescription>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={field.value ?? 0.5}
              onChange={(e) => field.onChange(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Subtle</span>
              <span>Moderate</span>
              <span>Extreme</span>
            </div>
          </Field>
        )}
      />
    </div>
  );
}

export { AgentProfiles };
