/**
 * Step indicator bar showing progress through the wizard.
 */

import { cn } from "@/lib/utils";
import type { WizardStep } from "../hooks/use-wizard";

function StepIndicator({
  steps,
  currentIndex,
  onStepClick,
  className,
  ...props
}: React.ComponentProps<"nav"> & {
  steps: WizardStep[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <nav
      data-slot="step-indicator"
      aria-label="Wizard progress"
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {steps.map((step, i) => {
        const isActive = i === currentIndex;
        const isCompleted = i < currentIndex;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick?.(i)}
            disabled={!onStepClick || i > currentIndex}
            className={cn(
              "group flex items-center gap-2 text-xs transition-colors disabled:pointer-events-none",
              isActive && "text-foreground font-medium",
              isCompleted && "text-primary",
              !isActive && !isCompleted && "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums transition-colors",
                isActive && "border-primary bg-primary text-primary-foreground",
                isCompleted && "border-primary bg-primary/10 text-primary",
                !isActive && !isCompleted && "border-border"
              )}
            >
              {isCompleted ? "\u2713" : i + 1}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export { StepIndicator };
