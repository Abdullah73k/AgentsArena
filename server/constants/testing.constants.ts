/**
 * Testing module configuration constants.
 *
 * Defaults for test orchestration, timing, and resource limits.
 */

/** Default test duration in seconds (10 minutes). */
export const DEFAULT_TEST_DURATION_SECONDS = 600;

/** Default LLM polling interval in milliseconds (7 seconds). */
export const DEFAULT_LLM_POLLING_INTERVAL_MS = 7_000;

/** Minimum LLM polling interval in milliseconds (3 seconds). */
export const MIN_LLM_POLLING_INTERVAL_MS = 3_000;

/** Maximum LLM polling interval in milliseconds (30 seconds). */
export const MAX_LLM_POLLING_INTERVAL_MS = 30_000;

/** Default behavior intensity for testing agents. */
export const DEFAULT_BEHAVIOR_INTENSITY = 0.5;

/** Maximum concurrent test runs allowed. */
export const MAX_CONCURRENT_TESTS = 3;

/** Coordination phase duration in seconds (agents plan before executing). */
export const COORDINATION_PHASE_SECONDS = 30;

/** Grace period after timeout before force-terminating (seconds). */
export const CLEANUP_GRACE_PERIOD_SECONDS = 10;

/** Maximum test duration in seconds (30 minutes). */
export const MAX_TEST_DURATION_SECONDS = 1_800;

/** Minimum test duration in seconds (1 minute). */
export const MIN_TEST_DURATION_SECONDS = 60;

/** Target LLM bot username prefix. */
export const TARGET_BOT_USERNAME_PREFIX = "llm";

/** Testing agent bot username prefix. */
export const TESTING_AGENT_USERNAME_PREFIX = "tester";
