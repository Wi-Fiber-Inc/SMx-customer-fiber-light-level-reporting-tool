import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { CENSUS_BENCHMARK } from "./geocoder.js";

export const DEFAULT_GEOCODE_CACHE_PATH = path.resolve(
  "data/geocode-cache.json",
);

// Creates an empty geocode cache.
export function createEmptyGeocodeCache() {
  return {
    benchmark: CENSUS_BENCHMARK,
    entries: [],
    provider: "census",
    updatedAt: null,
  };
}

// Reads the geocode cache or returns an empty one.
export async function readGeocodeCache(
  cachePath = DEFAULT_GEOCODE_CACHE_PATH,
) {
  try {
    const cache = JSON.parse(await readFile(cachePath, "utf8"));

    if (!cache || !Array.isArray(cache.entries)) {
      throw new Error("The geocode cache has an unexpected format.");
    }

    return cache;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return createEmptyGeocodeCache();
    }

    throw error;
  }
}

// Merges new geocodes into the existing cache.
export function mergeGeocodeResults(cache, results, updatedAt = new Date()) {
  const entriesByKey = new Map(
    cache.entries.map((entry) => [entry.key, entry]),
  );

  for (const result of results) {
    entriesByKey.set(result.key, result);
  }

  return {
    benchmark: CENSUS_BENCHMARK,
    entries: [...entriesByKey.values()].sort((left, right) =>
      left.key.localeCompare(right.key),
    ),
    provider: "census",
    updatedAt: updatedAt.toISOString(),
  };
}

// Writes the geocode cache without leaving a partial file.
export async function writeGeocodeCache(
  cache,
  cachePath = DEFAULT_GEOCODE_CACHE_PATH,
) {
  const directory = path.dirname(cachePath);
  const temporaryPath = `${cachePath}.tmp`;

  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  await rename(temporaryPath, cachePath);
}
