import assert from "node:assert/strict";
import test from "node:test";

import { createCacheSnapshot } from "../src/cache.js";

// Checks the summary counts stored with each cache snapshot.
test("builds cache summary counts", () => {
  const records = [
    { error: null, overallHealth: "healthy" },
    { error: null, overallHealth: "warning" },
    { error: null, overallHealth: "critical" },
    { error: "http-500", overallHealth: "no-signal" },
  ];
  const generatedAt = new Date("2026-07-17T12:00:00.000Z");

  const snapshot = createCacheSnapshot(records, generatedAt);

  assert.equal(snapshot.generatedAt, "2026-07-17T12:00:00.000Z");
  assert.deepEqual(snapshot.counts, {
    critical: 1,
    failed: 1,
    healthy: 1,
    noSignal: 1,
    successful: 3,
    total: 4,
    warning: 1,
  });
});
