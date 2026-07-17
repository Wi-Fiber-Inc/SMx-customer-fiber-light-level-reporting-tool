import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createCacheSnapshot, readCacheSnapshot } from "../src/cache.js";

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
    noSignal: 0,
    successful: 3,
    total: 4,
    warning: 1,
  });
});

// Checks that an older cache cannot double-count API errors as no signal.
test("corrects summary counts when reading an existing cache", async () => {
  const cachePath = path.join(os.tmpdir(), `smx-cache-${randomUUID()}.json`);
  const oldSnapshot = {
    counts: { failed: 1, healthy: 1, noSignal: 1, total: 2 },
    generatedAt: "2026-07-17T12:00:00.000Z",
    records: [
      { error: "http-500", overallHealth: "no-signal" },
      {
        error: null,
        oltReceiveDbm: 0,
        ontReceiveDbm: 0,
        overallHealth: "healthy",
      },
    ],
  };

  await writeFile(cachePath, JSON.stringify(oldSnapshot), "utf8");

  try {
    const snapshot = await readCacheSnapshot(cachePath);

    assert.equal(snapshot.counts.failed, 1);
    assert.equal(snapshot.counts.healthy, 0);
    assert.equal(snapshot.counts.noSignal, 1);
    assert.equal(snapshot.records[1].overallHealth, "no-signal");
  } finally {
    await unlink(cachePath);
  }
});
