import assert from "node:assert/strict";
import test from "node:test";

import { getAllPages } from "../src/pagination.js";

// Checks that every SMx page is requested in order.
test("gets all paginated records", async () => {
  const requestedPaths = [];
  const client = {
    // Returns two fake records per page.
    async get(path) {
      requestedPaths.push(path);
      const offset = Number(new URL(`https://test/${path}`).searchParams.get("offset"));
      const records = [1, 2, 3, 4, 5].slice(offset, offset + 2);
      return { data: records, totalCount: 5 };
    },
  };

  const records = await getAllPages(client, "test/items", 2);

  assert.deepEqual(records, [1, 2, 3, 4, 5]);
  assert.deepEqual(requestedPaths, [
    "test/items?limit=2&offset=0",
    "test/items?limit=2&offset=2",
    "test/items?limit=2&offset=4",
  ]);
});
