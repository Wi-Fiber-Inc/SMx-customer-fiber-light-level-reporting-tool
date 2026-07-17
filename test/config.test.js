import assert from "node:assert/strict";
import test from "node:test";

import {
  displaySmxBaseUrl,
  loadSmxConfig,
  SmxConfigError,
} from "../src/config.js";
import { createSmxUrl } from "../src/smx-client.js";

const credentials = {
  SMX_USERNAME: "report-reader",
  SMX_PASSWORD: "not-a-real-password",
};

// Checks that defaults load without putting credentials in the URL.
test("loads safe defaults without exposing credentials in the URL", () => {
  const config = loadSmxConfig(credentials);

  assert.equal(
    displaySmxBaseUrl(config),
    "https://10.100.100.220:18443/rest/v1",
  );
  assert.equal(config.allowSelfSignedCertificate, false);
  assert.equal(config.collectionIntervalMinutes, 15);
  assert.equal(config.collectionRatePerMinute, 240);
  assert.equal(config.tlsSecurityLevel, 2);
  assert.equal(config.requestTimeoutMs, 10_000);
  assert.equal(config.baseUrl.username, "");
  assert.equal(config.baseUrl.password, "");
});

// Checks that API paths are joined to the base URL correctly.
test("normalizes the base URL and creates a versioned API URL", () => {
  const config = loadSmxConfig({
    ...credentials,
    SMX_BASE_URL: "https://smx.example.test:18443/rest/v1///?ignored=true",
  });

  assert.equal(
    createSmxUrl(config.baseUrl, "/config/device?limit=1").toString(),
    "https://smx.example.test:18443/rest/v1/config/device?limit=1",
  );
});

// Checks the self-signed certificate and timeout settings.
test("accepts the scoped self-signed certificate setting", () => {
  const config = loadSmxConfig({
    ...credentials,
    SMX_ALLOW_SELF_SIGNED_CERT: "true",
    SMX_REQUEST_TIMEOUT_MS: "15000",
  });

  assert.equal(config.allowSelfSignedCertificate, true);
  assert.equal(config.requestTimeoutMs, 15_000);
});

// Checks that an older SMx certificate can use a scoped TLS level.
test("accepts a lower TLS security level for an older certificate", () => {
  const config = loadSmxConfig({
    ...credentials,
    SMX_TLS_SECURITY_LEVEL: "1",
  });

  assert.equal(config.tlsSecurityLevel, 1);
});

// Checks the collection interval and rate settings.
test("accepts custom collection settings", () => {
  const config = loadSmxConfig({
    ...credentials,
    SMX_COLLECTION_INTERVAL_MINUTES: "10",
    SMX_COLLECTION_RATE_PER_MINUTE: "200",
  });

  assert.equal(config.collectionIntervalMinutes, 10);
  assert.equal(config.collectionRatePerMinute, 200);
});

// Checks that both SMx credentials are required.
test("requires both credentials", () => {
  assert.throws(
    () => loadSmxConfig({ SMX_USERNAME: "report-reader" }),
    (error) =>
      error instanceof SmxConfigError && /SMX_PASSWORD/.test(error.message),
  );
});

// Checks that unsupported TLS security levels are rejected.
test("rejects an unsupported TLS security level", () => {
  assert.throws(
    () =>
      loadSmxConfig({
        ...credentials,
        SMX_TLS_SECURITY_LEVEL: "3",
      }),
    (error) =>
      error instanceof SmxConfigError && /SMX_TLS_SECURITY_LEVEL/.test(error.message),
  );
});

// Checks that the client refuses a plain HTTP connection.
test("rejects non-HTTPS SMx URLs", () => {
  assert.throws(
    () =>
      loadSmxConfig({
        ...credentials,
        SMX_BASE_URL: "http://10.100.100.220:18443/rest/v1",
      }),
    (error) => error instanceof SmxConfigError && /HTTPS/.test(error.message),
  );
});
