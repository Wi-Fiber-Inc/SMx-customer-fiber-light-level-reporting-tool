import assert from "node:assert/strict";
import test from "node:test";

import {
  joinSubscribersToOnts,
  normalizeSubscriber,
} from "../src/subscribers.js";

// Checks that only the account ID and primary address are kept.
test("normalizes a subscriber", () => {
  const subscriber = normalizeSubscriber({
    customId: " account-1 ",
    name: "Do not keep this name",
    locations: [
      {
        primary: true,
        contacts: [{ email: "do-not-keep@example.test" }],
        address: [
          {
            streetLine1: " 123 Fiber Lane ",
            city: "Network City",
            state: "TX",
            zip: "75000",
            country: "United States",
          },
        ],
      },
    ],
  });

  assert.deepEqual(subscriber, {
    accountId: "account-1",
    address: {
      streetLine1: "123 Fiber Lane",
      city: "Network City",
      state: "TX",
      zip: "75000",
      country: "United States",
    },
  });
  assert.equal("name" in subscriber, false);
  assert.equal("contacts" in subscriber, false);
});

// Checks that ONTs join to the matching subscriber account ID.
test("joins subscribers to ONTs", () => {
  const subscribers = [
    { accountId: "account-1", address: { streetLine1: "123 Fiber Lane" } },
  ];
  const onts = [
    {
      deviceName: "olt-1",
      ontId: "101",
      serialNumber: "serial-1",
      subscriberId: "account-1",
    },
    {
      deviceName: "olt-1",
      ontId: "102",
      serialNumber: "serial-2",
      subscriberId: "missing-account",
    },
  ];

  const rows = joinSubscribersToOnts(subscribers, onts);

  assert.equal(rows[0].matchedSubscriber, true);
  assert.deepEqual(rows[0].address, { streetLine1: "123 Fiber Lane" });
  assert.equal(rows[1].matchedSubscriber, false);
  assert.equal(rows[1].address, null);
});
