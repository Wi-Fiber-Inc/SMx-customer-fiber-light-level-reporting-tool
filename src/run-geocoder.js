import { readCacheSnapshot } from "./cache.js";
import {
  mergeGeocodeResults,
  readGeocodeCache,
  writeGeocodeCache,
} from "./geocode-cache.js";
import { collectUniqueAddresses, requestCensusGeocodes } from "./geocoder.js";

// Counts geocode results with one status.
function countResults(results, status) {
  return results.filter((result) => result.status === status).length;
}

// Geocodes addresses missing from the local coordinate cache.
async function main() {
  const lightLevelCache = await readCacheSnapshot();
  const geocodeCache = await readGeocodeCache();
  const uniqueAddresses = collectUniqueAddresses(lightLevelCache.records);
  const cachedKeys = new Set(geocodeCache.entries.map((entry) => entry.key));
  const missingAddresses = uniqueAddresses.filter(
    (entry) => !cachedKeys.has(entry.key),
  );

  console.log(`Unique service addresses: ${uniqueAddresses.length}`);
  console.log(`Already cached: ${uniqueAddresses.length - missingAddresses.length}`);
  console.log(`Missing coordinates: ${missingAddresses.length}`);

  if (missingAddresses.length === 0) {
    console.log("No addresses need geocoding.");
    return;
  }

  console.log(
    `Submitting ${missingAddresses.length} addresses to the U.S. Census Geocoder.`,
  );

  const results = await requestCensusGeocodes(missingAddresses);
  const nextCache = mergeGeocodeResults(geocodeCache, results);

  await writeGeocodeCache(nextCache);

  console.log(`Matched: ${countResults(results, "matched")}`);
  console.log(`Unmatched: ${countResults(results, "unmatched")}`);
  console.log("Saved coordinates to data/geocode-cache.json.");
}

main().catch((error) => {
  console.error(`Geocoding failed: ${error.message}`);
  process.exitCode = 1;
});
