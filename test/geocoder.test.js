import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCensusBatch,
  collectUniqueAddresses,
  createAddressKey,
  parseCensusBatchResults,
} from "../src/geocoder.js";

// Checks that duplicate service addresses are only geocoded once.
test("collects unique normalized addresses", () => {
  const first = {
    city: "Logan",
    country: "US",
    state: "UT",
    streetLine1: "100 Main St",
    zip: "84321",
  };
  const duplicate = {
    ...first,
    city: " logan ",
    streetLine1: "100  MAIN ST",
  };
  const entries = collectUniqueAddresses([
    { address: first },
    { address: duplicate },
    { address: null },
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, createAddressKey(first));
});

// Checks the CSV sent to the Census batch endpoint.
test("builds a quoted Census batch file", () => {
  const entries = [
    {
      address: {
        city: "Logan",
        state: "UT",
        streetLine1: '12 "A", Main St',
        zip: "84321",
      },
      key: "address-key",
    },
  ];

  const batch = buildCensusBatch(entries);

  assert.equal(batch.requests[0].id, "1");
  assert.equal(
    batch.csv,
    '1,"12 ""A"", Main St",Logan,UT,84321\r\n',
  );
});

// Checks matched and unmatched Census response rows.
test("parses Census batch results", () => {
  const checkedAt = new Date("2026-07-17T12:00:00.000Z");
  const requests = [
    { id: "1", key: "matched-key" },
    { id: "2", key: "unmatched-key" },
  ];
  const csv = [
    '1,"100 MAIN ST, LOGAN, UT, 84321",Match,Exact,"100 MAIN ST, LOGAN, UT, 84321","-111.835,41.736",123,L',
    '2,"999 UNKNOWN RD, LOGAN, UT, 84321",No_Match,,,,',
  ].join("\r\n");

  const results = parseCensusBatchResults(csv, requests, checkedAt);

  assert.deepEqual(results[0], {
    checkedAt: "2026-07-17T12:00:00.000Z",
    key: "matched-key",
    latitude: 41.736,
    longitude: -111.835,
    matchedAddress: "100 MAIN ST, LOGAN, UT, 84321",
    matchStatus: "Match",
    matchType: "Exact",
    status: "matched",
  });
  assert.equal(results[1].status, "unmatched");
  assert.equal(results[1].latitude, null);
  assert.equal(results[1].longitude, null);
});
