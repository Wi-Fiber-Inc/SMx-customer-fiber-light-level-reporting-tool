import {
  printCollectionError,
  runCollectionScheduler,
} from "./collector.js";
import { loadSmxConfig } from "./config.js";
import { geocodeMissingAddresses } from "./geocode-addresses.js";
import { loadWebConfig } from "./web-config.js";
import { startWebServer } from "./web-server.js";

// Stops the web server if the collector loop ends unexpectedly.
function handleCollectorFailure(error, server) {
  console.error("Collector stopped unexpectedly.");
  printCollectionError(error);
  server.close(() => {
    process.exitCode = 1;
  });
}

// Prints an automatic geocoding failure without stopping the app.
function printGeocodingError(error) {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`Geocoding failed: ${message}`);
}

// Starts the webpage and scheduled collector in one process.
export function startApplication(options = {}) {
  const environment = options.environment ?? process.env;
  const startWeb = options.startWeb ?? startWebServer;
  const startCollector = options.startCollector ?? runCollectionScheduler;
  const geocode = options.geocode ?? geocodeMissingAddresses;
  const onCollectorFailure =
    options.onCollectorFailure ?? handleCollectorFailure;
  const smxConfig = loadSmxConfig(environment);
  const webConfig = loadWebConfig(environment);
  const server = startWeb(webConfig);
  const collectorTask = Promise.resolve(
    startCollector(smxConfig, {
      afterCollection: geocode,
      logAfterCollectionError: printGeocodingError,
    }),
  );

  void collectorTask.catch((error) => onCollectorFailure(error, server));

  return { collectorTask, server };
}
