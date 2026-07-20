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

// Geocodes only the service addresses missing from the local cache.
export async function geocodeMissingAddresses(options = {}) {
  const log = options.log ?? console.log;
  const readLightLevels = options.readLightLevels ?? readCacheSnapshot;
  const readGeocodes = options.readGeocodes ?? readGeocodeCache;
  const requestGeocodes = options.requestGeocodes ?? requestCensusGeocodes;
  const writeGeocodes = options.writeGeocodes ?? writeGeocodeCache;
  const lightLevelCache = await readLightLevels();
  const geocodeCache = await readGeocodes();
  const uniqueAddresses = collectUniqueAddresses(lightLevelCache.records);
  const cachedKeys = new Set(geocodeCache.entries.map((entry) => entry.key));
  const missingAddresses = uniqueAddresses.filter(
    (entry) => !cachedKeys.has(entry.key),
  );

  log(`Unique service addresses: ${uniqueAddresses.length}`);
  log(`Already cached: ${uniqueAddresses.length - missingAddresses.length}`);
  log(`Missing coordinates: ${missingAddresses.length}`);

  if (missingAddresses.length === 0) {
    log("No addresses need geocoding.");
    return {
      cached: uniqueAddresses.length,
      matched: 0,
      submitted: 0,
      unmatched: 0,
    };
  }

  log(
    `Submitting ${missingAddresses.length} addresses to the U.S. Census Geocoder.`,
  );

  const results = await requestGeocodes(missingAddresses);
  const nextCache = mergeGeocodeResults(geocodeCache, results);

  await writeGeocodes(nextCache);

  const matched = countResults(results, "matched");
  const unmatched = countResults(results, "unmatched");

  log(`Matched: ${matched}`);
  log(`Unmatched: ${unmatched}`);
  log("Saved coordinates to data/geocode-cache.json.");

  return {
    cached: uniqueAddresses.length - missingAddresses.length,
    matched,
    submitted: missingAddresses.length,
    unmatched,
  };
}
