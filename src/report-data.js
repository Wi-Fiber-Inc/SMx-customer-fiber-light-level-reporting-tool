import { readCacheSnapshot } from "./cache.js";
import { readGeocodeCache } from "./geocode-cache.js";
import { createAddressKey } from "./geocoder.js";

// Reads valid coordinates from one cached geocode.
function getLocation(entry) {
  if (
    entry?.status !== "matched" ||
    !Number.isFinite(entry.latitude) ||
    !Number.isFinite(entry.longitude)
  ) {
    return null;
  }

  return {
    latitude: entry.latitude,
    longitude: entry.longitude,
  };
}

// Adds cached coordinates to the light-level report.
export function attachGeocodes(snapshot, geocodeCache) {
  const geocodesByKey = new Map(
    geocodeCache.entries.map((entry) => [entry.key, entry]),
  );
  const mappedAddresses = new Set();
  const unmatchedAddresses = new Set();
  const notGeocodedAddresses = new Set();
  let missingAddressRecords = 0;

  const records = snapshot.records.map((record) => {
    const key = createAddressKey(record.address);

    if (!key) {
      missingAddressRecords += 1;
      return {
        ...record,
        geocodeStatus: "missing-address",
        location: null,
      };
    }

    const geocode = geocodesByKey.get(key);
    const location = getLocation(geocode);

    if (location) {
      mappedAddresses.add(key);
    } else if (geocode?.status === "unmatched") {
      unmatchedAddresses.add(key);
    } else {
      notGeocodedAddresses.add(key);
    }

    return {
      ...record,
      geocodeStatus: location ? "matched" : geocode?.status ?? "not-geocoded",
      location,
    };
  });

  return {
    ...snapshot,
    counts: {
      ...snapshot.counts,
      mappedAddresses: mappedAddresses.size,
      missingAddressRecords,
      notGeocodedAddresses: notGeocodedAddresses.size,
      unmatchedAddresses: unmatchedAddresses.size,
    },
    records,
  };
}

// Reads both local caches for the Express report.
export async function readReportSnapshot() {
  const [snapshot, geocodeCache] = await Promise.all([
    readCacheSnapshot(),
    readGeocodeCache(),
  ]);

  return attachGeocodes(snapshot, geocodeCache);
}
