/**
 * Multi-step wizard state management hook.
 *
 * Tracks the current step index and provides navigation helpers.
 */

import { useState, useCallback, useMemo } from "react";

export interface WizardStep {
  id: string;
  label: string;
}

export function useWizard(steps: WizardStep[]) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentStep = steps[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;
  const progress = ((currentIndex + 1) / steps.length) * 100;

  const next = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);

  const prev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < steps.length) {
        setCurrentIndex(index);
      }
    },
    [steps.length]
  );

  return useMemo(
    () => ({
      steps,
      currentIndex,
      currentStep,
      isFirst,
      isLast,
      progress,
      next,
      prev,
      goTo,
    }),
    [steps, currentIndex, currentStep, isFirst, isLast, progress, next, prev, goTo]
  );
}
