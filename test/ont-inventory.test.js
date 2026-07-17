import assert from "node:assert/strict";
import test from "node:test";

import {
  countProvisionedOnts,
  getOltInventory,
  getOntPage,
  readOpticalLevels,
} from "../src/ont-inventory.js";

// Checks that the OLT inventory fields are cleaned up for the app.
test("normalizes the OLT inventory", async () => {
  const client = {
    // Returns a small fake OLT inventory.
    async get() {
      return {
        data: [
          { "device-name": "olt-one", provisionedONTsCount: 158 },
          { "device-name": "olt-two", provisionedONTsCount: "15" },
        ],
      };
    },
  };

  const olts = await getOltInventory(client);

  assert.deepEqual(olts, [
    { deviceName: "olt-one", provisionedOntCount: 158 },
    { deviceName: "olt-two", provisionedOntCount: 15 },
  ]);
  assert.equal(countProvisionedOnts(olts), 173);
});

// Checks that OLT names are safely added to the ONT path.
test("builds the ONT page request", async () => {
  let requestedPath;
  const client = {
    // Saves the request path for the test.
    async get(path) {
      requestedPath = path;
      return { data: [], totalCount: 0 };
    },
  };

  await getOntPage(client, "test olt/1", 25, 50);

  assert.equal(
    requestedPath,
    "config/device/test%20olt%2F1/ont?limit=25&offset=50&fields=device-name,ont-id,subscriber-id,serial-number",
  );
});

// Checks the SMx field mapping for both receive powers.
test("maps the live optical levels", () => {
  const levels = readOpticalLevels({
    "opt-signal-level": "-23.466",
    "ne-opt-signal-level": "-21.400",
    "tx-opt-level": "6.456",
  });

  assert.deepEqual(levels, {
    ontReceiveDbm: -23.466,
    oltReceiveDbm: -21.4,
    ontTransmitDbm: 6.456,
  });
});

// Checks that missing optical readings stay unavailable.
test("handles missing optical levels", () => {
  assert.deepEqual(readOpticalLevels({ "opt-signal-level": null }), {
    ontReceiveDbm: null,
    oltReceiveDbm: null,
    ontTransmitDbm: null,
  });
});
