/**
 * Step 4: Minecraft Setup
 *
 * Configure the Minecraft server connection and test duration.
 */

import { useFormContext, Controller } from "react-hook-form";

import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { formatDuration } from "@/lib/utils/format";
import type { CreateTestFormData } from "@/lib/schemas/test.schemas";

function MinecraftSetup() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CreateTestFormData>();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Minecraft Server</h3>
        <p className="text-xs text-muted-foreground">
          Configure the Minecraft server connection details and test parameters.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel>Host</FieldLabel>
          <Input
            {...register("config.minecraftServer.host")}
            placeholder="localhost"
          />
          {errors.config?.minecraftServer?.host && (
            <FieldError>
              {errors.config.minecraftServer.host.message}
            </FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel>Port</FieldLabel>
          <Input
            type="number"
            {...register("config.minecraftServer.port", {
              valueAsNumber: true,
            })}
            placeholder="25565"
          />
          {errors.config?.minecraftServer?.port && (
            <FieldError>
              {errors.config.minecraftServer.port.message}
            </FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel>Version</FieldLabel>
          <Input
            {...register("config.minecraftServer.version")}
            placeholder="1.21.10"
          />
          {errors.config?.minecraftServer?.version && (
            <FieldError>
              {errors.config.minecraftServer.version.message}
            </FieldError>
          )}
        </Field>
      </div>

      <Controller
        name="durationSeconds"
        control={control}
        render={({ field }) => (
          <Field>
            <FieldLabel>
              Duration: {formatDuration(field.value ?? 300)}
            </FieldLabel>
            <FieldDescription>
              How long the test should run before timing out (1-30 minutes).
            </FieldDescription>
            <input
              type="range"
              min={60}
              max={1800}
              step={30}
              value={field.value ?? 300}
              onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1m</span>
              <span>15m</span>
              <span>30m</span>
            </div>
          </Field>
        )}
      />

      <Controller
        name="config.llmPollingIntervalMs"
        control={control}
        render={({ field }) => (
          <Field>
            <FieldLabel>
              LLM Polling Interval: {((field.value ?? 7000) / 1000).toFixed(1)}s
            </FieldLabel>
            <FieldDescription>
              How frequently the target LLM is polled for decisions (3-30 seconds).
            </FieldDescription>
            <input
              type="range"
              min={3000}
              max={30000}
              step={500}
              value={field.value ?? 7000}
              onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>3s</span>
              <span>15s</span>
              <span>30s</span>
            </div>
          </Field>
        )}
      />

      <div className="flex gap-6">
        <Field orientation="horizontal">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              {...register("config.enableText")}
              className="accent-primary"
            />
            Enable Text Chat
          </label>
        </Field>

        <Field orientation="horizontal">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              {...register("config.enableVoice")}
              className="accent-primary"
            />
            Enable Voice
          </label>
        </Field>
      </div>
    </div>
  );
}

export { MinecraftSetup };
