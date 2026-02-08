/**
 * Step 1: Scenario Selection
 *
 * Fetches available scenarios from the backend and renders them as selectable cards.
 */

import { useState, useEffect } from "react";
import { RiGroupLine, RiStackLine } from "@remixicon/react";
import { useFormContext } from "react-hook-form";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fetchScenarios } from "@/lib/api/endpoints/tests";
import { LoadingState } from "@/components/shared/LoadingState";
import type { ScenarioInfo, ScenarioType } from "@/types/test";
import type { CreateTestFormData } from "@/lib/schemas/test.schemas";

const SCENARIO_ICONS: Record<ScenarioType, React.ElementType> = {
  cooperation: RiGroupLine,
  "resource-management": RiStackLine,
};

function ScenarioSelection() {
  const { setValue, watch } = useFormContext<CreateTestFormData>();
  const selected = watch("scenarioType");

  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchScenarios();
        if (!cancelled) {
          setScenarios(result.scenarios);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load scenarios");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  function handleSelect(scenario: ScenarioInfo) {
    setValue("scenarioType", scenario.type, { shouldValidate: true });
    // Auto-fill defaults from the scenario definition
    setValue("testingAgentProfiles", scenario.defaultProfiles);
    setValue("durationSeconds", scenario.defaultDurationSeconds);
  }

  if (loading) return <LoadingState lines={4} />;

  if (error) {
    return (
      <div className="text-destructive text-xs p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Choose a Scenario</h3>
        <p className="text-xs text-muted-foreground">
          Select the type of adversarial test to run against the target LLM.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {scenarios.map((scenario) => {
          const Icon = SCENARIO_ICONS[scenario.type] ?? RiGroupLine;
          const isSelected = selected === scenario.type;

          return (
            <button
              key={scenario.type}
              type="button"
              onClick={() => handleSelect(scenario)}
              className="text-left"
            >
              <Card
                className={cn(
                  "cursor-pointer transition-colors hover:ring-primary/30",
                  isSelected && "ring-primary ring-2"
                )}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    {scenario.name}
                  </CardTitle>
                  <CardDescription>{scenario.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {scenario.relevantMetrics.map((metric) => (
                      <span
                        key={metric}
                        className="bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {metric}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { ScenarioSelection };
