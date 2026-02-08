/**
 * Test results page — summary, performance summary, evaluation report, metrics, charts, action logs.
 * Implements Summary Card & Analysis: verdict, collected/derived metrics, scenario-tailored evaluation dimensions.
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
import type { TestRun, TestActionLog, ScenarioType } from "@/types/test";

const PIE_COLORS = ["#14b8a6", "#f59e0b", "#8b5cf6"];
const BAR_COLORS = { target: "#14b8a6", agent: "#f59e0b" };

const PROTOCOL_STRING =
  "The target LLM agent was placed in a Minecraft world with testing agents. It received the scenario objective and made decisions on a fixed polling interval. Testing agents executed predefined behaviours (e.g. non-cooperation, confusion). All actions and chat were logged.";

const SCENARIO_COPY: Record<
  ScenarioType,
  { objective: string; whyItMatters: string }
> = {
  cooperation: {
    objective:
      "To assess the agent's ability to pursue a shared goal (e.g. build a shelter) while coordinating with others who may refuse to help or act unpredictably.",
    whyItMatters:
      "This proxies real-world cases where an agent must collaborate with other agents or humans who may be uncooperative or noisy. A low error rate and sustained engagement (actions, messages) indicate the agent can operate under pressure.",
  },
  "resource-management": {
    objective:
      "To assess the agent's ability to manage resources and complete tasks when others may hoard or distract.",
    whyItMatters:
      "This proxies real-world cases where an agent must collaborate with other agents or humans who may be uncooperative or noisy. A low error rate and sustained engagement (actions, messages) indicate the agent can operate under pressure.",
  },
};

const SCENARIO_DIMENSION_IDS: Record<ScenarioType, string[]> = {
  cooperation: ["resilience", "hai"],
  "resource-management": ["resilience", "efficiency"],
};

const EVALUATION_DIMENSIONS: Record<
  string,
  {
    name: string;
    objective: string;
    metric: string;
    whyItMatters: string;
    requiredScenario: string;
  }
> = {
  resilience: {
    name: "Operational Resilience & Stress Testing",
    objective:
      "Evaluate system stability and error-recovery when subjected to adversarial or uncooperative behaviour.",
    metric:
      "Mean Time to Recovery (MTTR) — ms from discrepancy to corrective action",
    whyItMatters:
      "Enterprise tools must not crash on messy inputs. Tests self-healing under stress.",
    requiredScenario: "cooperation or resource-management",
  },
  hai: {
    name: "Human-Agent Interaction (HAI) Quality",
    objective:
      "Quantify coordination and responsiveness with other agents (or humans).",
    metric:
      "Instruction Turnaround Latency — time from stimulus to agent response",
    whyItMatters:
      "Poor coordination or latency causes abandonment. Determines copilot vs obstacle.",
    requiredScenario: "cooperation",
  },
  efficiency: {
    name: "Efficiency",
    objective:
      "Measure resource use and decision throughput (decisions, latency, actions per decision).",
    metric: "Actions per LLM decision; avg response time; token proxy (illustrative).",
    whyItMatters:
      "Cost and latency matter for production. Fewer decisions or high latency limit usefulness.",
    requiredScenario: "resource-management",
  },
};

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

  /** Scenario copy for objective and why it matters. Safe when test is null. */
  const scenarioCopy = useMemo(() => {
    if (!test) return { objective: "", protocol: PROTOCOL_STRING, whyItMatters: "" };
    const copy = SCENARIO_COPY[test.scenarioType];
    return {
      objective: copy.objective,
      protocol: PROTOCOL_STRING,
      whyItMatters: copy.whyItMatters,
    };
  }, [test]);

  /** Performance detail from test + logs (collected + derived). Safe when test is null. */
  const performanceDetail = useMemo(() => {
    const empty = {
      durationSec: 0,
      durationMin: 0,
      durationFormatted: "0s",
      avgResponseMs: 0,
      errorRatePct: 0,
      targetActions: 0,
      testingActions: 0,
      targetMessages: 0,
      testingMessages: 0,
      totalMessages: 0,
      llmDecisions: 0,
      llmErrors: 0,
      engagementPerMin: 0,
      targetSharePct: 0,
      responseBandLowMs: 0,
      responseBandHighMs: 0,
      actionsPerDecision: 0,
      minecraftActions: 0,
      discordActions: 0,
      llmDecisionLogs: 0,
      timeToFirstTargetSec: null as number | null,
    };
    if (!test) return empty;
    const mt = test.metrics;
    const startedAt = test.startedAt ? new Date(test.startedAt).getTime() : null;
    const endedAt = test.endedAt ? new Date(test.endedAt).getTime() : null;
    const durationSec =
      startedAt != null && endedAt != null
        ? Math.round((endedAt - startedAt) / 1000)
        : test.durationSeconds ?? 0;
    const durationMin = durationSec / 60 || 0;
    const avgResponseMs =
      mt.llmDecisionCount > 0
        ? Math.round(mt.totalLlmResponseTimeMs / mt.llmDecisionCount)
        : 0;
    const errorRatePct =
      mt.llmDecisionCount > 0
        ? Math.round((mt.llmErrorCount / mt.llmDecisionCount) * 100)
        : 0;
    const targetActions = mt.targetActionCount;
    const testingActions = mt.testingAgentActionCount;
    const targetMessages = mt.targetMessageCount;
    const testingMessages = mt.testingAgentMessageCount;
    const totalMessages = targetMessages + testingMessages;
    const totalActions = targetActions + testingActions;
    const targetSharePct =
      totalActions > 0 ? Math.round((targetActions / totalActions) * 100) : 0;
    const engagementPerMin =
      durationMin > 0
        ? (targetActions + targetMessages) / durationMin
        : 0;
    const responseBandLowMs = Math.round(avgResponseMs * 0.5);
    const responseBandHighMs = Math.round(avgResponseMs * 1.8);
    const actionsPerDecision =
      mt.llmDecisionCount > 0 ? targetActions / mt.llmDecisionCount : 0;
    const minecraftActions = logs.filter((l) => l.actionCategory === "minecraft").length;
    const discordActions = logs.filter((l) => l.actionCategory === "discord").length;
    const llmDecisionLogs = logs.filter((l) => l.actionCategory === "llm-decision").length;
    const firstTargetLog = logs.find((l) => l.sourceType === "target");
    const timeToFirstTargetSec =
      startedAt != null && firstTargetLog
        ? Math.round(
            (new Date(firstTargetLog.timestamp).getTime() - startedAt) / 1000
          )
        : null;
    return {
      durationSec,
      durationMin,
      durationFormatted: formatDuration(durationSec),
      avgResponseMs,
      errorRatePct,
      targetActions,
      testingActions,
      targetMessages,
      testingMessages,
      totalMessages,
      llmDecisions: mt.llmDecisionCount,
      llmErrors: mt.llmErrorCount,
      engagementPerMin,
      targetSharePct,
      responseBandLowMs,
      responseBandHighMs,
      actionsPerDecision,
      minecraftActions,
      discordActions,
      llmDecisionLogs,
      timeToFirstTargetSec,
    };
  }, [test, logs]);

  /** Verdict: label, summary, variant. Safe when test is null. */
  const verdict = useMemo(() => {
    const def = { label: "", summary: "", variant: "neutral" as const };
    if (!test) return def;
    const { status, completionReason, metrics } = test;
    const engagement =
      metrics.targetActionCount +
      metrics.targetMessageCount +
      metrics.llmDecisionCount >
      0;
    const errorRatePct = performanceDetail.errorRatePct;
    const lowErrors = metrics.llmErrorCount <= 2 && errorRatePct <= 20;
    if (status === "failed" || completionReason === "error") {
      return {
        label: "Did not perform well",
        summary:
          status === "failed"
            ? "Test failed or ended in an error state. Check for crashes, disconnects, or threshold breaches."
            : "Test completed with an error. The agent may need prompt or model tuning.",
        variant: "destructive" as const,
      };
    }
    if (status === "completed" && lowErrors && engagement) {
      return {
        label: "Performed well",
        summary:
          "Test completed with few errors and measurable engagement (actions and messages).",
        variant: "neutral" as const,
      };
    }
    if (status === "completed" && engagement) {
      return {
        label: "Performed adequately",
        summary:
          "Test completed with some engagement. Consider reviewing errors and latency.",
        variant: "neutral" as const,
      };
    }
    return {
      label: "Needs improvement",
      summary:
        "Completion status was acceptable but engagement was low or errors were high. The agent may need prompt or model tuning before relying on it in production.",
      variant: "neutral" as const,
    };
  }, [test, performanceDetail.errorRatePct]);

  /** Evaluation report: 1–2 dimensions per scenario with proxy text. Safe when test is null. */
  const evaluationReport = useMemo(() => {
    if (!test) return [] as { name: string; objective: string; metric: string; whyItMatters: string; proxyText: string }[];
    const scenarioType = test.scenarioType;
    const dimIds = SCENARIO_DIMENSION_IDS[scenarioType] ?? [];
    const pd = performanceDetail;
    return dimIds.map((id) => {
      const dim = EVALUATION_DIMENSIONS[id];
      if (!dim) return null;
      let proxyText = "";
      if (id === "resilience") {
        if (scenarioType === "cooperation") {
          proxyText = `This run stresses the agent with a confuser and a non-cooperator. Error rate: ${pd.errorRatePct}%. Test completed with ${pd.llmErrors} LLM errors. Proxy for stability under uncooperative behaviour (MTTR not measured).`;
        } else {
          proxyText = `This run stresses the agent with resource competition and distraction. Error rate: ${pd.errorRatePct}%. Test completed with ${pd.llmErrors} LLM errors. Proxy for stability (MTTR not measured).`;
        }
      } else if (id === "hai") {
        proxyText = `Coordination with confuser and non-cooperator: ${pd.totalMessages} total messages (target agent: ${pd.targetMessages}, testing agents: ${pd.testingMessages}). Target actions: ${pd.targetActions}. Engagement rate ~${Math.round(pd.engagementPerMin)}/min. Proxy for HAI; instruction turnaround would require a HITL scenario.`;
      } else if (id === "efficiency") {
        proxyText = `Decisions: ${pd.llmDecisions}, duration: ${pd.durationFormatted}, avg response: ${pd.avgResponseMs} ms, actions per decision: ${pd.actionsPerDecision.toFixed(1)}. Illustrative token proxy: decisions × 500 (not measured).`;
      } else {
        proxyText = `This run: Not measured. Run: ${dim.requiredScenario}.`;
      }
      return {
        name: dim.name,
        objective: dim.objective,
        metric: dim.metric,
        whyItMatters: dim.whyItMatters,
        proxyText,
      };
    }).filter(Boolean) as { name: string; objective: string; metric: string; whyItMatters: string; proxyText: string }[];
  }, [test, performanceDetail]);

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
        {/* Summary card (existing) */}
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

        {/* Performance summary card */}
        <Card>
          <CardHeader>
            <CardTitle>Performance summary</CardTitle>
            <CardDescription>
              Collected data, derived metrics, and whether the agent performed well.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">Objective</p>
              <p className="text-sm">{scenarioCopy.objective}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">Test protocol</p>
              <p className="text-sm">{scenarioCopy.protocol}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">Collected data from simulation</p>
              <ul className="text-muted-foreground list-inside list-disc space-y-0.5 text-sm">
                <li>Run duration: {performanceDetail.durationFormatted}</li>
                <li>LLM decisions: {performanceDetail.llmDecisions} Errors: {performanceDetail.llmErrors} Error rate: {performanceDetail.errorRatePct}%</li>
                <li>Avg LLM response time: {performanceDetail.avgResponseMs} ms</li>
                <li>Target agent: {performanceDetail.targetActions} actions, {performanceDetail.targetMessages} messages</li>
                <li>Testing agents: {performanceDetail.testingActions} actions, {performanceDetail.testingMessages} messages. Total messages: {performanceDetail.totalMessages}</li>
                <li>Action mix (from logs): Minecraft {performanceDetail.minecraftActions}, Discord {performanceDetail.discordActions}, LLM-decision {performanceDetail.llmDecisionLogs}</li>
              </ul>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">Derived & estimated metrics</p>
              <ul className="text-muted-foreground list-inside list-disc space-y-0.5 text-sm">
                <li>Engagement rate: ~{Math.round(performanceDetail.engagementPerMin)} target actions + messages per minute</li>
                <li>Target share of actions: {performanceDetail.targetSharePct}% (target vs all agents)</li>
                {performanceDetail.timeToFirstTargetSec != null && (
                  <li>Time to first target action: {performanceDetail.timeToFirstTargetSec}s</li>
                )}
                {performanceDetail.llmDecisions > 0 && (
                  <>
                    <li>Response time band: ~{performanceDetail.responseBandLowMs}–{performanceDetail.responseBandHighMs} ms (from average)</li>
                    <li>Actions per LLM decision: {performanceDetail.actionsPerDecision.toFixed(1)}</li>
                  </>
                )}
              </ul>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">Verdict</p>
              <p className="text-sm">
                <span
                  className={
                    verdict.variant === "destructive"
                      ? "text-destructive font-medium"
                      : "font-medium"
                  }
                >
                  {verdict.label}.
                </span>{" "}
                {verdict.summary}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">Why it matters</p>
              <p className="text-sm">{scenarioCopy.whyItMatters}</p>
            </div>
          </CardContent>
        </Card>

        {/* Evaluation report card */}
        <Card>
          <CardHeader>
            <CardTitle>Evaluation report</CardTitle>
            <CardDescription>
              {test.scenarioType === "cooperation"
                ? "This run targets Resilience and HAI (cooperation with confuser and non-cooperator)."
                : "This run targets Resilience and Efficiency (resource-management)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {evaluationReport.map((dim) => (
              <div key={dim.name} className="space-y-2">
                <p className="font-medium text-sm">{dim.name}</p>
                <p className="text-muted-foreground text-xs">{dim.objective}</p>
                <p className="text-xs">
                  <span className="text-muted-foreground">Business metric: </span>
                  {dim.metric}
                </p>
                <p className="text-xs">
                  <span className="text-muted-foreground">This run (proxy): </span>
                  {dim.proxyText}
                </p>
                <p className="text-muted-foreground text-xs">
                  <span className="font-medium">Why it matters: </span>
                  {dim.whyItMatters}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <MetricCard label="LLM Decisions" value={mt.llmDecisionCount} />
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
