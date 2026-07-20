import assert from "node:assert/strict";
import test from "node:test";

import { startApplication } from "../src/application.js";

// Checks that one startup launches both the webpage and collector.
test("starts the web server and scheduled collector together", () => {
  const environment = {
    SMX_USERNAME: "report-reader",
    SMX_PASSWORD: "not-a-real-password",
    SMX_COLLECTION_INTERVAL_MINUTES: "20",
    WEB_HOST: "0.0.0.0",
    WEB_PORT: "4269",
  };
  const server = { close() {} };
  const geocode = async () => {};
  let receivedCollectorConfig;
  let receivedCollectorOptions;
  let receivedWebConfig;

  const application = startApplication({
    environment,
    geocode,
    startCollector(config, options) {
      receivedCollectorConfig = config;
      receivedCollectorOptions = options;
      return new Promise(() => {});
    },
    startWeb(config) {
      receivedWebConfig = config;
      return server;
    },
  });

  assert.equal(application.server, server);
  assert.equal(receivedCollectorConfig.username, "report-reader");
  assert.equal(receivedCollectorConfig.collectionIntervalMinutes, 20);
  assert.equal(receivedCollectorOptions.afterCollection, geocode);
  assert.equal(typeof receivedCollectorOptions.logAfterCollectionError, "function");
  assert.deepEqual(receivedWebConfig, { host: "0.0.0.0", port: 4269 });
});
