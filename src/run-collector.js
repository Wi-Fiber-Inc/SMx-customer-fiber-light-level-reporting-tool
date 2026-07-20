import {
  printCollectionError,
  runCollection,
  runCollectionScheduler,
} from "./collector.js";
import { loadSmxConfig, SmxConfigError } from "./config.js";

const runOnce = process.argv.includes("--once");

try {
  const config = loadSmxConfig();

  if (runOnce) {
    await runCollection(config);
  } else {
    await runCollectionScheduler(config);
  }
} catch (error) {
  process.exitCode = 1;

  if (error instanceof SmxConfigError) {
    console.error(`Configuration error: ${error.message}`);
  } else {
    printCollectionError(error);
  }
}
