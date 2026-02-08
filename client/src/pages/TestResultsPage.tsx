/**
 * Test results page — summary metrics, charts, and action logs.
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RiArrowLeftLine, RiDownloadLine } from "@remixicon/react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AgentProfileBadge } from "@/components/shared/AgentProfileBadge";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDuration, formatDate, formatTime } from "@/lib/utils/format";
import { LLM_MODELS } from "@/lib/utils/constants";
import { fetchTest, fetchTestLogs } from "@/lib/api/endpoints/tests";
import type { TestRun, TestActionLog } from "@/types/test";

const PIE_COLORS = ["#14b8a6", "#f59e0b", "#8b5cf6"];
const BAR_COLORS = { target: "#14b8a6", agent: "#f59e0b" };

export default function TestResultsPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<TestRun | null>(null);
  const [logs, setLogs] = useState<TestActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;

    async function load() {
      try {
        const [testData, logData] = await Promise.all([
          fetchTest(testId!),
          fetchTestLogs(testId!),
        ]);
        if (!cancelled) {
          setTest(testData);
          setLogs(logData.logs);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load results");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [testId]);

  /** Action distribution by category for pie chart. */
  const categoryData = useMemo(() => {
    if (logs.length === 0) return [];
    const counts = new Map<string, number>();
    for (const log of logs) {
      counts.set(log.actionCategory, (counts.get(log.actionCategory) ?? 0) + 1);
    }
    return Array.from(counts, ([name, value]) => ({ name, value }));
  }, [logs]);

  /** Source comparison data for bar chart. */
  const sourceData = useMemo(() => {
    if (logs.length === 0) return [];
    const categories = new Set(logs.map((l) => l.actionCategory));
    return Array.from(categories, (cat) => {
      const targetCount = logs.filter(
        (l) => l.actionCategory === cat && l.sourceType === "target"
      ).length;
      const agentCount = logs.filter(
        (l) => l.actionCategory === cat && l.sourceType === "testing-agent"
      ).length;
      return { category: cat, target: targetCount, agent: agentCount };
    });
  }, [logs]);

  function handleExportJSON() {
    if (!test) return;
    const data = JSON.stringify({ test, logs }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-${test.testId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportCSV() {
    if (!logs.length) return;
    const headers = ["timestamp", "sourceType", "actionCategory", "actionDetail"];
    const rows = logs.map((l) =>
      [l.timestamp, l.sourceType, l.actionCategory, `"${l.actionDetail}"`].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-${test?.testId ?? "export"}-logs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Test Results" />
        <LoadingState lines={8} />
      </>
    );
  }

  if (error || !test) {
    return (
      <>
        <PageHeader title="Test Results" />
        <div className="space-y-4 text-center">
          <p className="text-destructive text-sm">{error ?? "Test not found"}</p>
          <Button variant="outline" onClick={() => navigate("/tests")}>
            <RiArrowLeftLine data-icon="inline-start" className="size-4" />
            Back to History
          </Button>
        </div>
      </>
    );
  }

  const model = LLM_MODELS.find((m) => m.id === test.targetLlmModel);
  const mt = test.metrics;
  const avgResponseMs =
    mt.llmDecisionCount > 0
      ? Math.round(mt.totalLlmResponseTimeMs / mt.llmDecisionCount)
      : 0;
  const totalDuration =
    test.startedAt && test.endedAt
      ? Math.round(
          (new Date(test.endedAt).getTime() -
            new Date(test.startedAt).getTime()) /
            1000
        )
      : test.durationSeconds;

  return (
    <>
      <PageHeader
        title="Test Results"
        description={`${test.scenarioType} \u00b7 ${model?.name ?? test.targetLlmModel}`}
        action={
          <Button variant="outline" onClick={() => navigate(`/tests/${test.testId}`)}>
            <RiArrowLeftLine data-icon="inline-start" className="size-4" />
            Dashboard
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Summary card */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>
              {formatDate(test.createdAt)} &middot; Duration: {formatDuration(totalDuration)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge domain="test" status={test.status} />
              {test.completionReason && (
                <span className="text-xs text-muted-foreground">
                  Reason: {test.completionReason}
                </span>
              )}
              <div className="flex flex-wrap gap-1">
                {test.testingAgentProfiles.map((p) => (
                  <AgentProfileBadge key={p} profile={p} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="LLM Decisions" value={mt.llmDecisionCount} />
          <MetricCard
            label="Avg Response"
            value={avgResponseMs}
            suffix="ms"
          />
          <MetricCard label="Target Actions" value={mt.targetActionCount} />
          <MetricCard label="Agent Actions" value={mt.testingAgentActionCount} />
          <MetricCard
            label="Messages"
            value={mt.targetMessageCount + mt.testingAgentMessageCount}
          />
          <MetricCard
            label="Errors"
            value={mt.llmErrorCount}
            trend={mt.llmErrorCount > 0 ? "down" : "neutral"}
          />
        </div>

        {/* Charts */}
        {logs.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Action distribution pie */}
            <Card>
              <CardHeader>
                <CardTitle>Action Distribution</CardTitle>
                <CardDescription>
                  Breakdown by action category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                    >
                      {categoryData.map((_, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.2 0.01 240)",
                        border: "1px solid oklch(0.3 0.01 240)",
                        borderRadius: 0,
                        fontSize: 11,
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Source comparison bar */}
            <Card>
              <CardHeader>
                <CardTitle>Target vs Agent Actions</CardTitle>
                <CardDescription>
                  Actions per category by source
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sourceData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.06)"
                    />
                    <XAxis
                      dataKey="category"
                      tick={{ fontSize: 10 }}
                      stroke="#888"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="#888"
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.2 0.01 240)",
                        border: "1px solid oklch(0.3 0.01 240)",
                        borderRadius: 0,
                        fontSize: 11,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="target"
                      name="Target LLM"
                      fill={BAR_COLORS.target}
                    />
                    <Bar
                      dataKey="agent"
                      name="Testing Agent"
                      fill={BAR_COLORS.agent}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Action logs */}
        <Card>
          <CardHeader>
            <CardTitle>Action Logs ({logs.length})</CardTitle>
            <CardDescription>
              Chronological record of all actions during the test
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <EmptyState
                title="No logs recorded"
                description="No actions were logged during this test run"
              />
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs" aria-label="Test action logs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-muted-foreground text-left text-[10px]">
                      <th className="py-1 pr-2 font-medium">Time</th>
                      <th className="py-1 pr-2 font-medium">Source</th>
                      <th className="py-1 pr-2 font-medium">Category</th>
                      <th className="py-1 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.logId}
                        className="border-t border-border/50"
                      >
                        <td className="py-1.5 pr-2 tabular-nums text-muted-foreground text-[10px]">
                          {formatTime(log.timestamp)}
                        </td>
                        <td className="py-1.5 pr-2">
                          <span
                            className={
                              log.sourceType === "target"
                                ? "text-primary text-[10px] font-medium"
                                : "text-amber-500 text-[10px] font-medium"
                            }
                          >
                            {log.sourceType === "target" ? "TARGET" : "AGENT"}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 font-mono text-[10px]">
                          {log.actionCategory}
                        </td>
                        <td className="py-1.5 max-w-[400px] truncate text-muted-foreground">
                          {log.actionDetail}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export buttons */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportJSON}>
            <RiDownloadLine data-icon="inline-start" className="size-4" />
            Export JSON
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <RiDownloadLine data-icon="inline-start" className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>
    </>
  );
}
