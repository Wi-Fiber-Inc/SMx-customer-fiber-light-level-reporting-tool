import {
  displaySmxBaseUrl,
  loadSmxConfig,
  SmxConfigError,
} from "./config.js";
import { SmxClient, SmxHttpError } from "./smx-client.js";

// Counts OLT records without printing the response body.
function countReturnedItems(data) {
  if (Array.isArray(data)) {
    return data.length;
  }

  if (data && typeof data === "object") {
    for (const key of ["items", "data", "results", "devices"]) {
      const value = data[key];

      if (Array.isArray(value)) {
        return value.length;
      }
    }
  }

  return null;
}

// Runs the one-record SMx connection check.
async function main() {
  const config = loadSmxConfig();
  const client = new SmxClient(config);
  const response = await client.get("config/device?limit=1");
  const returnedItems = countReturnedItems(response.data);

  console.log("SMx connection successful.");
  console.log(`Base URL: ${displaySmxBaseUrl(config)}`);
  console.log("Request: GET /config/device?limit=1");
  console.log(`HTTP status: ${response.statusCode}`);
  console.log(`Response time: ${response.durationMs} ms`);

  if (returnedItems !== null) {
    console.log(`OLT records returned: ${returnedItems}`);
  }

  if (response.totalCount !== null) {
    console.log(`Total OLT records reported by SMx: ${response.totalCount}`);
  }

  console.log("No SMx response payload was printed.");
}

try {
  await main();
} catch (error) {
  process.exitCode = 1;

  if (error instanceof SmxConfigError) {
    console.error(`Configuration error: ${error.message}`);
  } else if (error instanceof SmxHttpError && error.statusCode === 401) {
    console.error("SMx rejected the configured username or password (HTTP 401).");
  } else if (error instanceof SmxHttpError) {
    console.error(error.message);
  } else if (error instanceof Error && /certificate key too weak/i.test(error.message)) {
    console.error(
      "SMx has a weak certificate key. Set SMX_TLS_SECURITY_LEVEL=1 or replace the SMx certificate.",
    );
  } else if (error instanceof Error) {
    console.error(`SMx connection failed: ${error.message}`);
  } else {
    console.error("SMx connection failed for an unknown reason.");
  }
}
