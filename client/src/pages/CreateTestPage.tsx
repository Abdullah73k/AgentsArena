/**
 * Test creation page — 5-step wizard for configuring a new adversarial test.
 *
 * Steps:
 *  1. Scenario Selection
 *  2. LLM Configuration
 *  3. Agent Profiles
 *  4. Minecraft Setup
 *  5. Review & Create
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiArrowLeftLine, RiArrowRightLine, RiPlayLine } from "@remixicon/react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  createTestRequestSchema,
  type CreateTestFormData,
} from "@/lib/schemas/test.schemas";
import { DEFAULT_MC_CONFIG, DEFAULT_TEST_CONFIG } from "@/lib/utils/constants";
import { createTest } from "@/lib/api/endpoints/tests";

import { useWizard, type WizardStep } from "../features/test-creation/hooks/use-wizard";
import { StepIndicator } from "../features/test-creation/components/StepIndicator";
import { ScenarioSelection } from "../features/test-creation/components/ScenarioSelection";
import { LLMConfiguration } from "../features/test-creation/components/LLMConfiguration";
import { AgentProfiles } from "../features/test-creation/components/AgentProfiles";
import { MinecraftSetup } from "../features/test-creation/components/MinecraftSetup";
import { ReviewAndCreate } from "../features/test-creation/components/ReviewAndCreate";

const STEPS: WizardStep[] = [
  { id: "scenario", label: "Scenario" },
  { id: "llm", label: "LLM" },
  { id: "agents", label: "Agents" },
  { id: "minecraft", label: "Minecraft" },
  { id: "review", label: "Review" },
];

/** Fields to validate before allowing progression from each step. */
const STEP_FIELDS: Record<number, (keyof CreateTestFormData)[]> = {
  0: ["scenarioType"],
  1: ["targetLlmModel"],
  2: ["testingAgentProfiles"],
  3: ["durationSeconds", "config"],
};

export default function CreateTestPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const wizard = useWizard(STEPS);

  const methods = useForm<CreateTestFormData>({
    resolver: zodResolver(createTestRequestSchema),
    defaultValues: {
      scenarioType: undefined as unknown as CreateTestFormData["scenarioType"],
      targetLlmModel: "",
      testingAgentProfiles: [],
      durationSeconds: DEFAULT_TEST_CONFIG.durationSeconds,
      config: {
        llmPollingIntervalMs: DEFAULT_TEST_CONFIG.llmPollingIntervalMs,
        behaviorIntensity: DEFAULT_TEST_CONFIG.behaviorIntensity,
        enableVoice: DEFAULT_TEST_CONFIG.enableVoice,
        enableText: DEFAULT_TEST_CONFIG.enableText,
        targetLlmSystemPromptOverride: null,
        minecraftServer: { ...DEFAULT_MC_CONFIG },
      },
    },
    mode: "onChange",
  });

  async function handleNext() {
    // Validate current step fields before proceeding
    const fields = STEP_FIELDS[wizard.currentIndex];
    if (fields) {
      const valid = await methods.trigger(fields);
      if (!valid) return;
    }
    wizard.next();
  }

  async function handleSubmit(data: CreateTestFormData) {
    setSubmitting(true);
    try {
      const testRun = await createTest(data);
      toast.success("Test created successfully");
      navigate(`/tests/${testRun.testId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create test";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Create Test"
        description="Configure a new adversarial test scenario"
      />

      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Step indicator */}
          <StepIndicator
            steps={STEPS}
            currentIndex={wizard.currentIndex}
            onStepClick={(i) => {
              // Only allow going back, not forward (must validate)
              if (i < wizard.currentIndex) wizard.goTo(i);
            }}
          />

          {/* Progress bar */}
          <div className="h-0.5 w-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${wizard.progress}%` }}
            />
          </div>

          {/* Step content */}
          <div className="min-h-[360px]">
            {wizard.currentIndex === 0 && <ScenarioSelection />}
            {wizard.currentIndex === 1 && <LLMConfiguration />}
            {wizard.currentIndex === 2 && <AgentProfiles />}
            {wizard.currentIndex === 3 && <MinecraftSetup />}
            {wizard.currentIndex === 4 && <ReviewAndCreate />}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={wizard.prev}
              disabled={wizard.isFirst}
            >
              <RiArrowLeftLine data-icon="inline-start" className="size-4" />
              Back
            </Button>

            {wizard.isLast ? (
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Test"}
                <RiPlayLine data-icon="inline-end" className="size-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleNext}>
                Next
                <RiArrowRightLine data-icon="inline-end" className="size-4" />
              </Button>
            )}
          </div>
        </form>
      </FormProvider>
    </>
  );
}
