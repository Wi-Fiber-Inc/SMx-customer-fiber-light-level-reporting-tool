import { startApplication } from "./application.js";
import { SmxConfigError } from "./config.js";

try {
  startApplication();
} catch (error) {
  process.exitCode = 1;

  if (error instanceof SmxConfigError) {
    console.error(`Configuration error: ${error.message}`);
  } else if (error instanceof Error) {
    console.error(`Application failed: ${error.message}`);
  } else {
    console.error("Application failed for an unknown reason.");
  }
}
