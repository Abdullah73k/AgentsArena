-- CreateEnum
CREATE TYPE "ScenarioType" AS ENUM ('COOPERATION', 'RESOURCE_MANAGEMENT', 'COMMUNICATION_OVERLOAD', 'MULTI_AGENT_COORDINATION', 'ADVERSARIAL_REASONING');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('TARGET_LLM', 'TESTING_AGENT', 'COORDINATOR', 'OBSERVER');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('MINECRAFT', 'DISCORD');

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scenarioType" "ScenarioType" NOT NULL,
    "targetModel" TEXT NOT NULL,
    "status" "TestStatus" NOT NULL DEFAULT 'PENDING',
    "config" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAgent" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "AgentRole" NOT NULL,
    "behavioralProfile" TEXT,
    "systemPrompt" TEXT,
    "minecraftUsername" TEXT,
    "llmModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestEvent" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "agentId" TEXT,
    "source" "EventSource" NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestMetric" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "agentId" TEXT,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestReport" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "passed" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestRun_status_idx" ON "TestRun"("status");

-- CreateIndex
CREATE INDEX "TestRun_createdAt_idx" ON "TestRun"("createdAt");

-- CreateIndex
CREATE INDEX "TestAgent_testRunId_idx" ON "TestAgent"("testRunId");

-- CreateIndex
CREATE INDEX "TestEvent_testRunId_timestamp_idx" ON "TestEvent"("testRunId", "timestamp");

-- CreateIndex
CREATE INDEX "TestEvent_agentId_idx" ON "TestEvent"("agentId");

-- CreateIndex
CREATE INDEX "TestMetric_testRunId_idx" ON "TestMetric"("testRunId");

-- CreateIndex
CREATE UNIQUE INDEX "TestReport_testRunId_key" ON "TestReport"("testRunId");

-- AddForeignKey
ALTER TABLE "TestAgent" ADD CONSTRAINT "TestAgent_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestEvent" ADD CONSTRAINT "TestEvent_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestEvent" ADD CONSTRAINT "TestEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "TestAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestMetric" ADD CONSTRAINT "TestMetric_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestMetric" ADD CONSTRAINT "TestMetric_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "TestAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestReport" ADD CONSTRAINT "TestReport_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
