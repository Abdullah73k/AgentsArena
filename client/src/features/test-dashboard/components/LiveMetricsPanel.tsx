/**
 * Live metrics panel showing real-time test statistics.
 */

import { MetricCard } from "@/components/shared/MetricCard";
import type { LiveMetricsSummary } from "@/hooks/use-live-metrics";

function LiveMetricsPanel({ metrics }: { metrics: LiveMetricsSummary }) {
  return (
    <div data-slot="live-metrics-panel" className="grid grid-cols-2 gap-2">
      <MetricCard
        label="Avg Response"
        value={metrics.avgResponseTimeMs > 0 ? metrics.avgResponseTimeMs : "--"}
        suffix="ms"
      />
      <MetricCard
        label="Agent Actions"
        value={metrics.testingAgentActions}
      />
      <MetricCard
        label="Messages"
        value={metrics.targetMessages + metrics.testingAgentMessages}
      />
      <MetricCard
        label="Errors"
        value={metrics.errorCount}
        trend={metrics.errorCount > 0 ? "down" : "neutral"}
      />
    </div>
  );
}

export { LiveMetricsPanel };
