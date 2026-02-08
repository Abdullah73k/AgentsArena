/**
 * Step 2: LLM Configuration
 *
 * Select the target LLM model and optionally override its system prompt.
 */

import { useFormContext, Controller } from "react-hook-form";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { LLM_MODELS } from "@/lib/utils/constants";
import type { CreateTestFormData } from "@/lib/schemas/test.schemas";

function LLMConfiguration() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<CreateTestFormData>();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Configure Target LLM</h3>
        <p className="text-xs text-muted-foreground">
          Choose which LLM model to test and customize its behavior.
        </p>
      </div>

      <Field>
        <FieldLabel>Model</FieldLabel>
        <FieldDescription>
          The LLM that will be evaluated under adversarial conditions.
        </FieldDescription>
        <Controller
          name="targetLlmModel"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {LLM_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span>{model.name}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {model.provider} &middot; {model.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.targetLlmModel && (
          <FieldError>{errors.targetLlmModel.message}</FieldError>
        )}
      </Field>

      <Field>
        <FieldLabel>System Prompt Override (optional)</FieldLabel>
        <FieldDescription>
          Provide a custom system prompt for the target LLM. Leave blank to use
          the scenario default.
        </FieldDescription>
        <Textarea
          {...register("config.targetLlmSystemPromptOverride")}
          placeholder="You are a helpful Minecraft assistant..."
          rows={4}
        />
      </Field>
    </div>
  );
}

export { LLMConfiguration };
