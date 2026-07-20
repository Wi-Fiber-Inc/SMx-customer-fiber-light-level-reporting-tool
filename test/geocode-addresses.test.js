import assert from "node:assert/strict";
import test from "node:test";

import { geocodeMissingAddresses } from "../src/geocode-addresses.js";
import { createAddressKey } from "../src/geocoder.js";

const cachedAddress = {
  city: "Blanco",
  state: "TX",
  streetLine1: "100 Main St",
  zip: "78606",
};
const missingAddress = {
  city: "Blanco",
  state: "TX",
  streetLine1: "200 Main St",
  zip: "78606",
};

// Checks that automatic geocoding submits only uncached addresses.
test("geocodes only addresses missing from the cache", async () => {
  const logs = [];
  let requestedEntries;
  let writtenCache;

  const summary = await geocodeMissingAddresses({
    log(message) {
      logs.push(message);
    },
    async readGeocodes() {
      return {
        entries: [
          {
            key: createAddressKey(cachedAddress),
            latitude: 30.1,
            longitude: -98.4,
            status: "matched",
          },
        ],
      };
    },
    async readLightLevels() {
      return {
        records: [
          { address: cachedAddress },
          { address: missingAddress },
          { address: missingAddress },
        ],
      };
    },
    async requestGeocodes(entries) {
      requestedEntries = entries;
      return [
        {
          key: entries[0].key,
          latitude: 30.2,
          longitude: -98.5,
          status: "matched",
        },
      ];
    },
    async writeGeocodes(cache) {
      writtenCache = cache;
    },
  });

  assert.equal(requestedEntries.length, 1);
  assert.equal(requestedEntries[0].key, createAddressKey(missingAddress));
  assert.equal(writtenCache.entries.length, 2);
  assert.deepEqual(summary, {
    cached: 1,
    matched: 1,
    submitted: 1,
    unmatched: 0,
  });
  assert.ok(logs.includes("Missing coordinates: 1"));
});

// Checks that a complete geocode cache causes no outside request.
test("skips geocoding when every address is cached", async () => {
  let requested = false;
  let written = false;

  const summary = await geocodeMissingAddresses({
    log() {},
    async readGeocodes() {
      return {
        entries: [{ key: createAddressKey(cachedAddress), status: "matched" }],
      };
    },
    async readLightLevels() {
      return { records: [{ address: cachedAddress }] };
    },
    async requestGeocodes() {
      requested = true;
      return [];
    },
    async writeGeocodes() {
      written = true;
    },
  });

  assert.deepEqual(summary, {
    cached: 1,
    matched: 0,
    submitted: 0,
    unmatched: 0,
  });
  assert.equal(requested, false);
  assert.equal(written, false);
});
