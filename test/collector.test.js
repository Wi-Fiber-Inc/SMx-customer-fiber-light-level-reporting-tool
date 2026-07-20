import assert from "node:assert/strict";
import test from "node:test";

import { runCollectionScheduler } from "../src/collector.js";

// Checks that a failed collection is retried after the configured wait.
test("keeps scheduling collections after a failed pass", async () => {
  const stopScheduler = new Error("stop scheduler test");
  const collectionErrors = [];
  const waits = [];
  let attempts = 0;
  let currentTime = 0;

  await assert.rejects(
    runCollectionScheduler(
      { collectionIntervalMinutes: 15 },
      {
        async collect() {
          attempts += 1;
          currentTime += 1_000;

          if (attempts === 1) {
            throw new Error("temporary SMx failure");
          }
        },
        log() {},
        logError(error) {
          collectionErrors.push(error.message);
        },
        now() {
          return currentTime;
        },
        async pause(waitMs) {
          waits.push(waitMs);

          if (waits.length === 2) {
            throw stopScheduler;
          }
        },
      },
    ),
    stopScheduler,
  );

  assert.equal(attempts, 2);
  assert.deepEqual(collectionErrors, ["temporary SMx failure"]);
  assert.deepEqual(waits, [899_000, 899_000]);
});
