import assert from "node:assert/strict";
import test from "node:test";

import { createAddressKey } from "../src/geocoder.js";
import { attachGeocodes } from "../src/report-data.js";

const matchedAddress = {
  city: "Fredericksburg",
  country: "United States",
  state: "TX",
  streetLine1: "100 Main St",
  zip: "78624",
};

// Checks that report rows receive cached map coordinates.
test("attaches geocodes and counts map coverage", () => {
  const unmatchedAddress = {
    ...matchedAddress,
    streetLine1: "200 Main St",
  };
  const pendingAddress = {
    ...matchedAddress,
    streetLine1: "300 Main St",
  };
  const snapshot = {
    counts: { total: 5 },
    records: [
      { address: matchedAddress, ontId: "1" },
      { address: matchedAddress, ontId: "2" },
      { address: unmatchedAddress, ontId: "3" },
      { address: pendingAddress, ontId: "4" },
      { address: null, ontId: "5" },
    ],
  };
  const geocodeCache = {
    entries: [
      {
        key: createAddressKey(matchedAddress),
        latitude: 30.27,
        longitude: -98.87,
        status: "matched",
      },
      {
        key: createAddressKey(unmatchedAddress),
        latitude: null,
        longitude: null,
        status: "unmatched",
      },
    ],
  };

  const report = attachGeocodes(snapshot, geocodeCache);

  assert.deepEqual(report.records[0].location, {
    latitude: 30.27,
    longitude: -98.87,
  });
  assert.equal(report.records[1].geocodeStatus, "matched");
  assert.equal(report.records[2].geocodeStatus, "unmatched");
  assert.equal(report.records[3].geocodeStatus, "not-geocoded");
  assert.equal(report.records[4].geocodeStatus, "missing-address");
  assert.deepEqual(report.counts, {
    mappedAddresses: 1,
    missingAddressRecords: 1,
    notGeocodedAddresses: 1,
    total: 5,
    unmatchedAddresses: 1,
  });
});
