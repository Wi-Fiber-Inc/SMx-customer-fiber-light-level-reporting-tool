import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createEmptyGeocodeCache,
  mergeGeocodeResults,
  readGeocodeCache,
  writeGeocodeCache,
} from "../src/geocode-cache.js";

// Checks that new geocodes replace matching cached entries.
test("merges geocode cache entries by address key", () => {
  const cache = createEmptyGeocodeCache();
  cache.entries.push({ key: "same", status: "unmatched" });
  const updatedAt = new Date("2026-07-17T12:00:00.000Z");
  const merged = mergeGeocodeResults(
    cache,
    [{ key: "same", latitude: 41.7, longitude: -111.8, status: "matched" }],
    updatedAt,
  );

  assert.equal(merged.entries.length, 1);
  assert.equal(merged.entries[0].status, "matched");
  assert.equal(merged.updatedAt, "2026-07-17T12:00:00.000Z");
});

// Checks that the geocode cache can be written and read back.
test("writes and reads the geocode cache", async () => {
  const cachePath = path.join(os.tmpdir(), `geocodes-${randomUUID()}.json`);
  const cache = mergeGeocodeResults(
    createEmptyGeocodeCache(),
    [{ key: "one", status: "unmatched" }],
  );

  try {
    await writeGeocodeCache(cache, cachePath);
    const loaded = await readGeocodeCache(cachePath);

    assert.deepEqual(loaded, cache);
  } finally {
    await unlink(cachePath);
  }
});
