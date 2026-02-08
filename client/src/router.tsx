/**
 * Application router configuration.
 *
 * Uses React Router v7 with lazy-loaded pages
 * to keep initial bundle size small (bundle-dynamic-imports).
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

const HomePage = lazy(() => import("@/pages/HomePage"));
const CreateTestPage = lazy(() => import("@/pages/CreateTestPage"));
const TestDashboardPage = lazy(() => import("@/pages/TestDashboardPage"));
const TestResultsPage = lazy(() => import("@/pages/TestResultsPage"));
const TestHistoryPage = lazy(() => import("@/pages/TestHistoryPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

function PageFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-muted-foreground text-sm">Loading...</div>
    </div>
  );
}

export function Router() {
  return (
    <BrowserRouter>
      <AppLayout>
        <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/tests/new" element={<CreateTestPage />} />
              <Route path="/tests/:testId" element={<TestDashboardPage />} />
              <Route path="/tests/:testId/results" element={<TestResultsPage />} />
              <Route path="/tests" element={<TestHistoryPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppLayout>
    </BrowserRouter>
  );
}
