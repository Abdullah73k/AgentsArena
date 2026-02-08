/**
 * Live test dashboard page with balanced grid layout.
 *
 * Layout (12-column grid):
 *  Row 1: TestStatusCard (col-8) + LiveMetricsPanel (col-4)
 *  Row 2: AgentStatusGrid (col-12)
 *  Row 3: DiscordChatFeed (col-12)
 *  Row 4: ActionTimeline (col-12)
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/LoadingState";
import { RiArrowLeftLine, RiFileChartLine } from "@remixicon/react";

import { fetchTest } from "@/lib/api/endpoints/tests";
import { ApiClientError } from "@/lib/api/client";
import { useTestWebSocket } from "@/hooks/use-test-websocket";
import { useBotPositions } from "@/hooks/use-bot-positions";
import { useLiveMetrics } from "@/hooks/use-live-metrics";
import { useAgentBotIds } from "@/hooks/use-agent-bot-ids";
import type { TestRun } from "@/types/test";

import { TestStatusCard } from "../features/test-dashboard/components/TestStatusCard";
import { LiveMetricsPanel } from "../features/test-dashboard/components/LiveMetricsPanel";
import { AgentStatusGrid } from "../features/test-dashboard/components/AgentStatusGrid";
import { DiscordChatFeed } from "../features/test-dashboard/components/DiscordChatFeed";
import { ActionTimeline } from "../features/test-dashboard/components/ActionTimeline";

export default function TestDashboardPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTest = useCallback(async () => {
    if (!testId) return;
    try {
      const data = await fetchTest(testId);
      setTest(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        setError(
          "Test not found. It may have been cleared after a server restart (in-memory storage). Create a new test from the dashboard."
        );
      } else {
        setError(err instanceof Error ? err.message : "Failed to load test");
      }
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    loadTest();
  }, [loadTest]);

  // WebSocket subscriptions
  const ws = useTestWebSocket(testId);

  // Use WS metrics when live; fall back to persisted test.metrics so data shows after load or completion
  const effectiveMetrics = ws.metrics ?? test?.metrics ?? null;
  const liveMetrics = useLiveMetrics(effectiveMetrics);

  // Refetch test when run completes so we show final status and persisted metrics
  useEffect(() => {
    if (ws.completed && testId) loadTest();
  }, [ws.completed, testId, loadTest]);

  // Resolve testing agent IDs to their Minecraft bot IDs
  const testingAgentBotIds = useAgentBotIds(test?.testingAgentIds ?? []);

  // Collect all bot IDs for minecraft WS subscription
  const botIds = test
    ? [
        ...(test.targetBotId ? [test.targetBotId] : []),
        ...testingAgentBotIds,
      ]
    : [];
  const { bots } = useBotPositions(botIds);

  if (loading) {
    return (
      <>
        <PageHeader title="Test Dashboard" />
        <LoadingState lines={6} />
      </>
    );
  }

  if (error || !test) {
    return (
      <>
        <PageHeader title="Test Dashboard" />
        <div className="space-y-4 text-center">
          <p className="text-destructive text-sm">
            {error ?? "Test not found"}
          </p>
          <Button variant="outline" onClick={() => navigate("/history")}>
            <RiArrowLeftLine data-icon="inline-start" className="size-4" />
            Back to History
          </Button>
        </div>
      </>
    );
  }

  const isComplete = ws.status === "completed" || test.status === "completed";

  return (
    <>
      <PageHeader
        title={`Test: ${test.testId.slice(0, 16)}...`}
        description={`${test.scenarioType} scenario`}
        action={
          isComplete ? (
            <Button
              variant="outline"
              onClick={() => navigate(`/tests/${test.testId}/results`)}
            >
              <RiFileChartLine data-icon="inline-start" className="size-4" />
              View Results
            </Button>
          ) : undefined
        }
      />

      {/* Balanced 12-column grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Row 1 */}
        <div className="col-span-12 lg:col-span-8">
          <TestStatusCard
            test={test}
            wsStatus={ws.status}
            onRefresh={loadTest}
          />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <LiveMetricsPanel metrics={liveMetrics} />
        </div>

        {/* Row 2 */}
        <div className="col-span-12">
          <AgentStatusGrid
            profiles={test.testingAgentProfiles}
            bots={bots}
          />
        </div>

        {/* Row 3 */}
        <div className="col-span-12">
          <DiscordChatFeed messages={ws.chatMessages} />
        </div>

        {/* Row 4 */}
        <div className="col-span-12">
          <ActionTimeline actions={ws.agentActions} />
        </div>
      </div>
    </>
  );
}
