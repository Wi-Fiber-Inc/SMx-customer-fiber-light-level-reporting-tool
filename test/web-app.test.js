import assert from "node:assert/strict";
import test from "node:test";

import { createWebApp } from "../src/web-app.js";

// Starts Express on a random local test port.
function startTestServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        server,
      });
    });
  });
}

// Stops an Express test server cleanly.
function stopTestServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

// Checks the cache API and its security headers.
test("serves the cached report", async () => {
  const snapshot = {
    counts: { total: 1 },
    generatedAt: "2026-07-17T20:03:02.876Z",
    records: [{ accountId: "account-1" }],
  };
  const app = createWebApp({
    // Returns one fake cache snapshot.
    async readSnapshot() {
      return snapshot;
    },
  });
  const { baseUrl, server } = await startTestServer(app);

  try {
    const response = await fetch(`${baseUrl}/api/readings`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), snapshot);
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.match(
      response.headers.get("content-security-policy"),
      /default-src 'self'/,
    );
    assert.match(
      response.headers.get("content-security-policy"),
      /https:\/\/tile\.openstreetmap\.org/,
    );
    assert.equal(
      response.headers.get("referrer-policy"),
      "strict-origin-when-cross-origin",
    );
  } finally {
    await stopTestServer(server);
  }
});
// Checks the message returned when no cache exists.
test("reports an unavailable cache", async () => {
  const app = createWebApp({
    // Simulates a missing cache file.
    async readSnapshot() {
      throw new Error("missing");
    },
  });
  const { baseUrl, server } = await startTestServer(app);

  try {
    const response = await fetch(`${baseUrl}/api/readings`);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.error, "cache-unavailable");
  } finally {
    await stopTestServer(server);
  }
});

// Checks that Express serves the report page.
test("serves the report page", async () => {
  const app = createWebApp();
  const { baseUrl, server } = await startTestServer(app);

  try {
    const response = await fetch(baseUrl);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /SMx Fiber Levels/);
  } finally {
    await stopTestServer(server);
  }
});

// Checks that Express serves Leaflet from the local dependency.
test("serves the local map library", async () => {
  const app = createWebApp();
  const { baseUrl, server } = await startTestServer(app);

  try {
    const response = await fetch(`${baseUrl}/vendor/leaflet/leaflet.js`);

    assert.equal(response.status, 200);
    assert.match(await response.text(), /Leaflet/);
  } finally {
    await stopTestServer(server);
  }
});
