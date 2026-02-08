/**
 * Home page — Dashboard overview with recent tests, system health, and quick actions.
 */

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  RiAddLine,
  RiHistoryLine,
  RiPlayLine,
  RiEyeLine,
  RiCloseCircleLine,
  RiLoader4Line,
  RiServerLine,
  RiGamepadLine,
  RiDiscordLine,
  RiArrowRightLine,
} from "@remixicon/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AgentProfileBadge } from "@/components/shared/AgentProfileBadge";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate, formatTime, formatDuration } from "@/lib/utils/format";
import { LLM_MODELS } from "@/lib/utils/constants";
import { listTests } from "@/lib/api/endpoints/tests";
import { apiClient } from "@/lib/api/client";
import type { TestRun } from "@/types/test";

/** Check backend /health endpoint. */
async function checkHealth(): Promise<boolean> {
  try {
    await apiClient.get<{ status: string }>("/health");
    return true;
  } catch {
    return false;
  }
}

export default function HomePage() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [healthResult, testsResult] = await Promise.allSettled([
        checkHealth(),
        listTests(),
      ]);

      if (cancelled) return;

      setApiHealthy(
        healthResult.status === "fulfilled" ? healthResult.value : false
      );

      if (testsResult.status === "fulfilled") {
        setTests(testsResult.value.tests);
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const activeTests = tests.filter(
    (t) =>
      t.status === "executing" ||
      t.status === "initializing" ||
      t.status === "coordination"
  );
  const completedTests = tests.filter((t) => t.status === "completed");
  const failedTests = tests.filter((t) => t.status === "failed");
  const recentTests = [...tests]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Agentic LLM Testing Framework — Minecraft Environment"
        action={
          <Link to="/tests/new">
            <Button className="gap-1.5">
              <RiAddLine className="size-3.5" data-icon="inline-start" />
              New Test
            </Button>
          </Link>
        }
      />

      {loading ? (
        <LoadingState lines={6} />
      ) : (
        <div className="space-y-6">
          {/* Stats overview */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Total Tests"
              value={tests.length}
            />
            <MetricCard
              label="Active"
              value={activeTests.length}
              trend={activeTests.length > 0 ? "up" : "neutral"}
            />
            <MetricCard
              label="Completed"
              value={completedTests.length}
            />
            <MetricCard
              label="Failed"
              value={failedTests.length}
              trend={failedTests.length > 0 ? "down" : "neutral"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Recent tests — spans 2 columns */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent Tests</CardTitle>
                      <CardDescription>
                        Latest test runs across all scenarios
                      </CardDescription>
                    </div>
                    <Link to="/tests">
                      <Button variant="ghost" size="sm" className="gap-1">
                        View All
                        <RiArrowRightLine className="size-3" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentTests.length === 0 ? (
                    <EmptyState
                      title="No tests yet"
                      description="Create your first adversarial test to get started"
                      action={
                        <Link to="/tests/new">
                          <Button size="sm" className="gap-1.5">
                            <RiAddLine className="size-3.5" />
                            Create Test
                          </Button>
                        </Link>
                      }
                    />
                  ) : (
                    <div className="space-y-0">
                      {recentTests.map((test) => {
                        const model = LLM_MODELS.find(
                          (m) => m.id === test.targetLlmModel
                        );
                        const dur =
                          test.startedAt && test.endedAt
                            ? Math.round(
                                (new Date(test.endedAt).getTime() -
                                  new Date(test.startedAt).getTime()) /
                                  1000
                              )
                            : null;

                        return (
                          <div
                            key={test.testId}
                            className="flex items-center gap-3 border-b border-border/50 py-2.5 last:border-b-0"
                          >
                            <StatusBadge
                              domain="test"
                              status={test.status}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium truncate">
                                  {test.scenarioType}
                                </span>
                                <span className="text-muted-foreground">
                                  {model?.name ?? test.targetLlmModel}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                <span>
                                  {formatDate(test.createdAt)} {formatTime(test.createdAt)}
                                </span>
                                {dur !== null && (
                                  <span className="tabular-nums">
                                    {formatDuration(dur)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {test.testingAgentProfiles
                                .slice(0, 2)
                                .map((p) => (
                                  <AgentProfileBadge
                                    key={p}
                                    profile={p}
                                  />
                                ))}
                              {test.testingAgentProfiles.length > 2 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{test.testingAgentProfiles.length - 2}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                onClick={() =>
                                  navigate(`/tests/${test.testId}`)
                                }
                                aria-label="View test dashboard"
                              >
                                <RiEyeLine className="size-3" />
                              </Button>
                              {(test.status === "completed" ||
                                test.status === "failed") && (
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() =>
                                    navigate(
                                      `/tests/${test.testId}/results`
                                    )
                                  }
                                  aria-label="View test results"
                                >
                                  <RiPlayLine className="size-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right sidebar — System status + Quick actions */}
            <div className="space-y-4">
              {/* System Status */}
              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                  <CardDescription>
                    Backend services health
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <RiServerLine className="size-3" />
                        API Server
                      </span>
                      {apiHealthy === null ? (
                        <RiLoader4Line className="size-3 animate-spin text-muted-foreground" />
                      ) : apiHealthy ? (
                        <LiveIndicator label="Online" active />
                      ) : (
                        <span className="flex items-center gap-1 text-destructive font-medium">
                          <RiCloseCircleLine className="size-3" />
                          Offline
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <RiGamepadLine className="size-3" />
                        Minecraft
                      </span>
                      <span className="text-muted-foreground/60 font-medium">
                        {activeTests.length > 0 ? (
                          <LiveIndicator label="Active" active />
                        ) : (
                          "Idle"
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <RiDiscordLine className="size-3" />
                        Discord
                      </span>
                      <span className="text-muted-foreground/60 font-medium">
                        {apiHealthy ? "Connected" : "--"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <Link to="/tests/new">
                      <Button className="w-full gap-1.5" size="sm">
                        <RiAddLine className="size-3.5" />
                        New Test Run
                      </Button>
                    </Link>
                    <Link to="/tests">
                      <Button
                        variant="outline"
                        className="w-full gap-1.5"
                        size="sm"
                      >
                        <RiHistoryLine className="size-3.5" />
                        View All Tests
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Active tests indicator */}
              {activeTests.length > 0 && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <LiveIndicator />
                      <span className="text-xs font-medium">
                        {activeTests.length} active test{activeTests.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {activeTests.map((t) => (
                        <button
                          key={t.testId}
                          onClick={() => navigate(`/tests/${t.testId}`)}
                          className="flex w-full items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <RiEyeLine className="size-3" />
                          <span className="truncate">{t.scenarioType}</span>
                          <StatusBadge domain="test" status={t.status} />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
