import assert from "node:assert/strict";
import test from "node:test";

import {
  collectLightLevels,
  getOverallHealth,
  getReadingHealth,
} from "../src/light-levels.js";
import { SmxHttpError } from "../src/smx-client.js";

// Checks every agreed receive-power boundary.
test("rates receive-power readings", () => {
  assert.equal(getReadingHealth(null), "no-signal");
  assert.equal(getReadingHealth(-30), "no-signal");
  assert.equal(getReadingHealth(-29), "critical");
  assert.equal(getReadingHealth(-28), "critical");
  assert.equal(getReadingHealth(-26), "warning");
  assert.equal(getReadingHealth(-25), "warning");
  assert.equal(getReadingHealth(-24.999), "healthy");
});

// Checks that the worse receive-power status wins.
test("uses the worse overall health", () => {
  assert.equal(getOverallHealth("healthy", "warning"), "warning");
  assert.equal(getOverallHealth("critical", "healthy"), "critical");
  assert.equal(getOverallHealth("no-signal", "warning"), "no-signal");
});

// Checks that successful and failed ONT calls become cache records.
test("collects light levels and keeps failures", async () => {
  let waits = 0;
  const limiter = {
    // Counts the request slots used by the collector.
    async wait() {
      waits += 1;
    },
  };
  const client = {
    // Returns one good status and one HTTP failure.
    async get(path) {
      if (path.includes("/ont/101/")) {
        return {
          data: {
            "ne-opt-signal-level": "-21.400",
            "opt-signal-level": "-23.466",
          },
        };
      }

      throw new SmxHttpError(500, "/hidden-test-path");
    },
  };
  const rows = [
    { accountId: "account-1", deviceName: "olt-1", ontId: "101" },
    { accountId: "account-2", deviceName: "olt-2", ontId: "102" },
  ];

  const records = await collectLightLevels(client, rows, { limiter });

  assert.equal(waits, 2);
  assert.equal(records[0].ontReceiveDbm, -23.466);
  assert.equal(records[0].oltReceiveDbm, -21.4);
  assert.equal(records[0].overallHealth, "healthy");
  assert.equal(records[0].error, null);
  assert.equal(records[1].overallHealth, "no-signal");
  assert.equal(records[1].error, "http-500");
});
