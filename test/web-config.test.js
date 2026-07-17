import assert from "node:assert/strict";
import test from "node:test";

import { loadWebConfig } from "../src/web-config.js";

// Checks that the web server stays local by default.
test("loads local web defaults", () => {
  assert.deepEqual(loadWebConfig({}), {
    host: "127.0.0.1",
    port: 3000,
  });
});

// Checks custom web host and port settings.
test("loads custom web settings", () => {
  assert.deepEqual(
    loadWebConfig({ WEB_HOST: "0.0.0.0", WEB_PORT: "8080" }),
    { host: "0.0.0.0", port: 8080 },
  );
});

// Checks that bad web ports are rejected.
test("rejects an invalid web port", () => {
  assert.throws(
    () => loadWebConfig({ WEB_PORT: "70000" }),
    /WEB_PORT/,
  );
});
