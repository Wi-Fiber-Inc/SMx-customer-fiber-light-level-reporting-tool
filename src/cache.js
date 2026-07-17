import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { getOverallHealth, getReadingHealth } from "./light-levels.js";

export const DEFAULT_CACHE_PATH = path.resolve("data/light-level-cache.json");

// Counts successful readings that match a health status.
function countHealth(records, status) {
  return records.filter(
    (record) => record.error === null && record.overallHealth === status,
  ).length;
}

// Builds summary counts from the current records.
function createCounts(records) {
  return {
    critical: countHealth(records, "critical"),
    failed: records.filter((record) => record.error !== null).length,
    healthy: countHealth(records, "healthy"),
    noSignal: countHealth(records, "no-signal"),
    successful: records.filter((record) => record.error === null).length,
    total: records.length,
    warning: countHealth(records, "warning"),
  };
}

// Re-rates cached records when receive-power rules change.
function normalizeRecordHealth(record) {
  const hasOpticalLevels =
    Object.hasOwn(record, "ontReceiveDbm") ||
    Object.hasOwn(record, "oltReceiveDbm");

  if (!hasOpticalLevels) {
    return record;
  }

  const ontHealth = getReadingHealth(record.ontReceiveDbm);
  const oltHealth = getReadingHealth(record.oltReceiveDbm);

  return {
    ...record,
    oltHealth,
    ontHealth,
    overallHealth: getOverallHealth(ontHealth, oltHealth),
  };
}

// Re-rates every record in one cache snapshot.
function normalizeRecordHealths(records) {
  return records.map(normalizeRecordHealth);
}

// Builds the cache file with summary counts.
export function createCacheSnapshot(records, generatedAt = new Date()) {
  const normalizedRecords = normalizeRecordHealths(records);

  return {
    generatedAt: generatedAt.toISOString(),
    counts: createCounts(normalizedRecords),
    records: normalizedRecords,
  };
}

// Writes the cache to a temporary file before replacing the old one.
export async function writeCacheSnapshot(snapshot, cachePath = DEFAULT_CACHE_PATH) {
  const directory = path.dirname(cachePath);
  const temporaryPath = `${cachePath}.tmp`;

  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await rename(temporaryPath, cachePath);
}

// Reads and checks the latest cache snapshot.
export async function readCacheSnapshot(cachePath = DEFAULT_CACHE_PATH) {
  const contents = await readFile(cachePath, "utf8");
  const snapshot = JSON.parse(contents);

  if (!snapshot || !Array.isArray(snapshot.records) || !snapshot.counts) {
    throw new Error("The light-level cache has an unexpected format.");
  }

  const records = normalizeRecordHealths(snapshot.records);

  return {
    ...snapshot,
    counts: createCounts(records),
    records,
  };
}
