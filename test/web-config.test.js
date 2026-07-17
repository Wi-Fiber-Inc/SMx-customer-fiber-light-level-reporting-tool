import assert from "node:assert/strict";
import test from "node:test";

import { loadWebConfig } from "../src/web-config.js";

// Checks that the web server listens on every IPv4 interface by default.
test("loads VM-friendly web defaults", () => {
  assert.deepEqual(loadWebConfig({}), {
    host: "0.0.0.0",
    port: 3000,
  });
});

// Checks custom web host and port settings.
test("loads custom web settings", () => {
  assert.deepEqual(
    loadWebConfig({ WEB_HOST: "127.0.0.1", WEB_PORT: "8080" }),
    { host: "127.0.0.1", port: 8080 },
  );
});

// Checks that bad web ports are rejected.
test("rejects an invalid web port", () => {
  assert.throws(
    () => loadWebConfig({ WEB_PORT: "70000" }),
    /WEB_PORT/,
  );
});
