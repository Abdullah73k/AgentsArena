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

/** Evaluation dimension IDs. */
type EvaluationDimensionId =
  | "precision"
  | "resilience"
  | "generalization"
  | "efficiency"
  | "drift"
  | "safety"
  | "hai";

/** Which dimensions this scenario type targets (1–2 per test). */
const SCENARIO_DIMENSIONS: Record<
  "cooperation" | "resource-management",
  EvaluationDimensionId[]
> = {
  cooperation: ["resilience", "hai"],
  "resource-management": ["resilience", "efficiency"],
};

/** Full dimension definitions (used only for dimensions relevant to the current test). */
const EVALUATION_DIMENSIONS: Record<
  EvaluationDimensionId,
  {
    name: string;
    objective: string;
    metric: string;
    whyItMatters: string;
    requiredScenario: string;
  }
> = {
  precision: {
    name: "Functional Precision & Adherence Audit",
    objective:
      "Quantitatively assess the agent's ability to translate structured requirements into precise execution without deviation.",
    metric: "SPR = Correctly Placed Voxels / Total Required Voxels",
    whyItMatters:
      "Proxies strict business logic. SPR below 99% indicates high operational risk.",
    requiredScenario: "Blueprint scenario (JSON spec for voxel structure)",
  },
  resilience: {
    name: "Operational Resilience & Stress Testing",
    objective:
      "Evaluate system stability and error-recovery when subjected to adversarial or uncooperative behaviour.",
    metric: "Mean Time to Recovery (MTTR) — ms from discrepancy to corrective action",
    whyItMatters:
      "Enterprise tools must not crash on messy inputs. Tests self-healing under stress.",
    requiredScenario: "High-entropy / adversarial injection",
  },
  generalization: {
    name: "Algorithmic Generalization & Bias Assessment",
    objective:
      "Audit for overfitting to privileged data and consistent performance across contexts.",
    metric: "Contextual Disparity Score (CDS) = |Performance_Forest − Performance_Desert|",
    whyItMatters:
      "Failure in resource-scarce contexts = distribution shift intolerance.",
    requiredScenario: "Same task across biomes (e.g. Forest vs Desert)",
  },
  efficiency: {
    name: "Computational Efficiency & Cost Analysis",
    objective:
      "Measure financial viability: ratio of computational expenditure to tangible output.",
    metric: "Cost Per Action (CPA) = (Tokens × Cost per Token) / Completions",
    whyItMatters:
      "Agents that 'think' too much for simple tasks destroy margins.",
    requiredScenario: "Token logging middleware",
  },
  drift: {
    name: "Longitudinal Drift Monitoring",
    objective:
      "Detect concept drift and catastrophic forgetting over time.",
    metric: "Adaptability Decay Rate when environment changes by X%",
    whyItMatters:
      "APIs change in production; deprecated logic = failed adaptation.",
    requiredScenario: "Baseline vs post-update environment",
  },
  safety: {
    name: "Safety Alignment & Interpretability (XAI)",
    objective:
      "Verify guardrail adherence and transparent reasoning for autonomous decisions.",
    metric: "Guardrail Refusal Rate (GRR) — % harmful instructions rejected",
    whyItMatters:
      "Corporate AI must prioritize safety over obedience.",
    requiredScenario: "Prohibited-command injection scenario",
  },
  hai: {
    name: "Human–Agent Interaction (HAI) Quality",
    objective:
      "Quantify coordination and responsiveness with other agents (or humans).",
    metric: "Instruction Turnaround Latency — time from stimulus to agent response",
    whyItMatters:
      "Poor coordination or latency causes abandonment. Determines copilot vs obstacle.",
    requiredScenario: "HITL scenario (mid-task parameter change)",
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

  /** Scenario copy for summary card. Must run before early returns (hooks order). */
  const scenarioCopy = useMemo(() => {
    if (!test) return { objective: "", protocol: "", whyItMatters: "" };
    const isCoop = test.scenarioType === "cooperation";
    return {
      objective: isCoop
        ? "To assess the agent's ability to pursue a shared goal (e.g. build a shelter) while coordinating with others who may refuse to help or act unpredictably."
        : "To assess the agent's ability to manage resources and complete tasks when other agents may hoard, distract, or work against the objective.",
      protocol: "The target LLM agent was placed in a Minecraft world with testing agents. It received the scenario objective and made decisions on a fixed polling interval. Testing agents executed predefined behaviors (e.g. non-cooperation, confusion). All actions and chat were logged.",
      whyItMatters:
        "This proxies real-world cases where an agent must collaborate with other agents or humans who may be uncooperative or noisy. A low error rate and sustained engagement (actions, messages) indicate the agent can operate under pressure.",
    };
  }, [test?.scenarioType, test]);

  /** Verdict: did the agent perform well? Must run before early returns (hooks order). */
  const verdict = useMemo(() => {
    const fallback = {
      label: "—",
      summary: "",
      variant: "default" as const,
    };
    if (!test) return fallback;
    const mt = test.metrics;
    const completedOk = test.completionReason === "success" || test.status === "completed";
    const errorRate = mt.llmDecisionCount > 0 ? mt.llmErrorCount / mt.llmDecisionCount : 0;
    const hadEngagement = mt.targetActionCount + mt.targetMessageCount > 0 || mt.llmDecisionCount > 0;
    const lowErrors = mt.llmErrorCount <= 2 && errorRate <= 0.2;

    if (test.status === "failed" || test.completionReason === "error") {
      return {
        label: "Did not perform well",
        summary: "The test ended in a failed or error state. The agent may have crashed, disconnected, or exceeded error thresholds.",
        variant: "destructive" as const,
      };
    }
    if (completedOk && lowErrors && hadEngagement) {
      return {
        label: "Performed well",
        summary: "The test completed successfully with few LLM errors and measurable engagement (actions and/or messages). The agent remained responsive under the scenario conditions.",
        variant: "default" as const,
      };
    }
    if (completedOk && hadEngagement) {
      return {
        label: "Performed adequately",
        summary: "The test completed and the agent showed some engagement. Consider reviewing error count and response times for production readiness.",
        variant: "default" as const,
      };
    }
    return {
      label: "Needs improvement",
      summary: "Completion status was acceptable but engagement was low or errors were high. The agent may need prompt or model tuning before relying on it in production.",
      variant: "default" as const,
    };
  }, [test]);

  /** Detailed metrics for performance card: real + derived/estimated from test and logs. */
  const performanceDetail = useMemo(() => {
    if (!test) {
      return {
        durationSec: 0,
        durationMin: 0,
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
        minecraftActions: 0,
        discordActions: 0,
        llmDecisionLogs: 0,
        timeToFirstTargetSec: null as number | null,
        actionsPerDecision: 0,
      };
    }
    const mt = test.metrics;
    const durationSec =
      test.startedAt && test.endedAt
        ? (new Date(test.endedAt).getTime() - new Date(test.startedAt).getTime()) / 1000
        : test.durationSeconds || 1;
    const durationMin = durationSec / 60 || 0.5;
    const avgResponseMs =
      mt.llmDecisionCount > 0 ? Math.round(mt.totalLlmResponseTimeMs / mt.llmDecisionCount) : 0;
    const errorRatePct =
      mt.llmDecisionCount > 0 ? Math.round((mt.llmErrorCount / mt.llmDecisionCount) * 100) : 0;
    const totalActions = mt.targetActionCount + mt.testingAgentActionCount;
    const targetSharePct = totalActions > 0 ? Math.round((mt.targetActionCount / totalActions) * 100) : 0;
    const engagementPerMin =
      durationMin > 0
        ? Math.round((mt.targetActionCount + mt.targetMessageCount) / durationMin)
        : 0;
    const responseBandLowMs = Math.round(avgResponseMs * 0.5);
    const responseBandHighMs = Math.round(avgResponseMs * 1.8);
    const actionsPerDecision =
      mt.llmDecisionCount > 0
        ? Math.round((mt.targetActionCount / mt.llmDecisionCount) * 10) / 10
        : 0;

    const minecraftActions = logs.filter((l) => l.actionCategory === "minecraft").length;
    const discordActions = logs.filter((l) => l.actionCategory === "discord").length;
    const llmDecisionLogs = logs.filter((l) => l.actionCategory === "llm-decision").length;
    const targetLogs = logs.filter((l) => l.sourceType === "target");
    const firstTarget = targetLogs[0];
    const startedAtMs = test.startedAt ? new Date(test.startedAt).getTime() : null;
    const timeToFirstTargetSec =
      startedAtMs && firstTarget
        ? Math.round((new Date(firstTarget.timestamp).getTime() - startedAtMs) / 1000)
        : null;

    return {
      durationSec,
      durationMin,
      avgResponseMs,
      errorRatePct,
      targetActions: mt.targetActionCount,
      testingActions: mt.testingAgentActionCount,
      targetMessages: mt.targetMessageCount,
      testingMessages: mt.testingAgentMessageCount,
      totalMessages: mt.targetMessageCount + mt.testingAgentMessageCount,
      llmDecisions: mt.llmDecisionCount,
      llmErrors: mt.llmErrorCount,
      engagementPerMin,
      targetSharePct,
      responseBandLowMs,
      responseBandHighMs,
      minecraftActions,
      discordActions,
      llmDecisionLogs,
      timeToFirstTargetSec,
      actionsPerDecision,
    };
  }, [test, logs]);

  /** Evaluation report: only dimensions relevant to this scenario, with tailored proxy copy. */
  const evaluationReport = useMemo(() => {
    if (!test) return [];
    const scenarioType = test.scenarioType;
    const dimensionIds = SCENARIO_DIMENSIONS[scenarioType] ?? ["resilience"];
    const pd = performanceDetail;
    const completed = test.completionReason === "success" || test.status === "completed";
    const estimatedTokens = pd.llmDecisions * 500;
    const isCooperation = scenarioType === "cooperation";

    return dimensionIds.map((id): { id: EvaluationDimensionId; name: string; objective: string; metric: string; whyItMatters: string; requiredScenario: string; status: "proxy" | "not_measured"; proxyText: string | null } => {
      const dim = EVALUATION_DIMENSIONS[id];
      switch (id) {
        case "resilience":
          return {
            ...dim,
            id,
            status: "proxy" as const,
            proxyText: isCooperation
              ? `This run stresses the agent with a confuser and a non-cooperator. Error rate: ${pd.errorRatePct}%. Test ${completed ? "completed" : "ended"} with ${pd.llmErrors} LLM errors. Proxy for stability under uncooperative behaviour (MTTR not measured).`
              : `Error rate ${pd.errorRatePct}%. Test ${completed ? "completed" : "ended"} with ${pd.llmErrors} LLM errors. Proxy for stability (no MTTR from this run).`,
          };
        case "hai":
          return {
            ...dim,
            id,
            status: "proxy" as const,
            proxyText: isCooperation
              ? `Coordination with confuser and non-cooperator: ${pd.totalMessages} total messages (target agent: ${pd.targetMessages}, testing agents: ${pd.testingMessages}). Target actions: ${pd.targetActions}. Engagement rate ~${pd.engagementPerMin}/min. Proxy for HAI; instruction turnaround would require a HITL scenario.`
              : `Total messages: ${pd.totalMessages} (target: ${pd.targetMessages}). Instruction turnaround not measured (HITL scenario required).`,
          };
        case "efficiency":
          return {
            ...dim,
            id,
            status: "proxy" as const,
            proxyText: `Decisions: ${pd.llmDecisions} in ${formatDuration(Math.round(pd.durationSec))}. Avg response ${pd.avgResponseMs} ms. Actions per decision: ~${pd.actionsPerDecision}. Estimated token proxy: ~${estimatedTokens.toLocaleString()} tokens (illustrative).`,
          };
        default:
          return { ...dim, id, status: "not_measured" as const, proxyText: null };
      }
    });
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

        {/* Performance summary & verdict */}
        <Card>
          <CardHeader>
            <CardTitle>Performance summary</CardTitle>
            <CardDescription>
              Collected data, derived metrics, and whether the agent performed well
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs font-medium text-foreground">Objective</p>
              <p className="text-muted-foreground text-xs/relaxed mt-0.5">
                {scenarioCopy.objective}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Test protocol</p>
              <p className="text-muted-foreground text-xs/relaxed mt-0.5">
                {scenarioCopy.protocol}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Collected data from simulation</p>
              <ul className="text-muted-foreground text-xs/relaxed space-y-0.5 list-none">
                <li>Run duration: {formatDuration(Math.round(performanceDetail.durationSec))}</li>
                <li>LLM decisions: {performanceDetail.llmDecisions} · Errors: {performanceDetail.llmErrors} · Error rate: {performanceDetail.errorRatePct}%</li>
                <li>Avg LLM response time: {performanceDetail.avgResponseMs} ms</li>
                <li>Target agent: {performanceDetail.targetActions} actions, {performanceDetail.targetMessages} messages</li>
                <li>Testing agents: {performanceDetail.testingActions} actions, {performanceDetail.testingMessages} messages · Total messages: {performanceDetail.totalMessages}</li>
                <li>Action mix (from logs): Minecraft {performanceDetail.minecraftActions}, Discord {performanceDetail.discordActions}, LLM-decision {performanceDetail.llmDecisionLogs}</li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Derived & estimated metrics</p>
              <ul className="text-muted-foreground text-xs/relaxed space-y-0.5 list-none">
                <li>Engagement rate: ~{performanceDetail.engagementPerMin} target actions + messages per minute</li>
                <li>Target share of actions: {performanceDetail.targetSharePct}% (target vs all agents)</li>
                {performanceDetail.timeToFirstTargetSec != null && (
                  <li>Time to first target action: ~{performanceDetail.timeToFirstTargetSec} s</li>
                )}
                {performanceDetail.avgResponseMs > 0 && (
                  <li>Estimated response-time band: ~{performanceDetail.responseBandLowMs}–{performanceDetail.responseBandHighMs} ms (from average)</li>
                )}
                {performanceDetail.llmDecisions > 0 && (
                  <li>Target actions per LLM decision: ~{performanceDetail.actionsPerDecision}</li>
                )}
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground">Verdict</p>
              <p className={verdict.variant === "destructive" ? "text-destructive text-xs/relaxed mt-0.5 font-medium" : "text-muted-foreground text-xs/relaxed mt-0.5"}>
                {verdict.label}. {verdict.summary}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Why it matters</p>
              <p className="text-muted-foreground text-xs/relaxed mt-0.5">
                {scenarioCopy.whyItMatters}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Evaluation Report — only dimensions relevant to this scenario */}
        <Card>
          <CardHeader>
            <CardTitle>Evaluation report</CardTitle>
            <CardDescription>
              {test.scenarioType === "cooperation"
                ? "This run targets Resilience and HAI (cooperation with confuser and non-cooperator)."
                : test.scenarioType === "resource-management"
                  ? "This run targets Resilience and Efficiency (resource-management scenario)."
                  : "Metrics relevant to this test scenario."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {evaluationReport.map((dim) => (
              <div key={dim.id} className="border-border/60 rounded-md border-l-4 border-l-primary/40 bg-muted/30 pl-3 pr-3 py-2.5">
                <p className="text-sm font-semibold text-foreground">{dim.name}</p>
                <p className="text-muted-foreground text-xs/relaxed mt-0.5">{dim.objective}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  <span className="font-medium text-foreground">Business metric:</span> {dim.metric}
                </p>
                <div className="mt-1.5 text-xs">
                  {dim.status === "proxy" && dim.proxyText && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">This run (proxy):</span> {dim.proxyText}
                    </p>
                  )}
                  {dim.status === "not_measured" && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">This run:</span> Not measured. Run: {dim.requiredScenario}.
                    </p>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 text-xs italic">Why it matters: {dim.whyItMatters}</p>
              </div>
            ))}
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
