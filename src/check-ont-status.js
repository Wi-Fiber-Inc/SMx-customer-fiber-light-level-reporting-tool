import {
  displaySmxBaseUrl,
  loadSmxConfig,
  SmxConfigError,
} from "./config.js";
import {
  countProvisionedOnts,
  getOltInventory,
  getOntPage,
  getOntStatus,
  readOpticalLevels,
} from "./ont-inventory.js";
import { SmxClient, SmxHttpError } from "./smx-client.js";

// Sorts OLTs so the largest one is sampled first.
function sortOltsByOntCount(olts) {
  return [...olts].sort(
    (left, right) => right.provisionedOntCount - left.provisionedOntCount,
  );
}

// Finds one ONT that returns a live status response.
async function findSampleStatus(client, olts) {
  for (const olt of sortOltsByOntCount(olts)) {
    if (!olt.deviceName || olt.provisionedOntCount === 0) {
      continue;
    }

    const page = await getOntPage(client, olt.deviceName, 1, 0);
    const ont = page.data[0];

    if (!ont?.["ont-id"]) {
      continue;
    }

    try {
      return await getOntStatus(client, olt.deviceName, ont["ont-id"]);
    } catch (error) {
      if (!(error instanceof SmxHttpError)) {
        throw error;
      }
    }
  }

  throw new Error("No sampled ONT returned a live status response.");
}

// Formats a dBm value for the console.
function formatDbm(value) {
  return value === null ? "unavailable" : `${value.toFixed(3)} dBm`;
}

// Runs the OLT inventory and one-ONT status check.
async function main() {
  const config = loadSmxConfig();
  const client = new SmxClient(config);
  const olts = await getOltInventory(client);

  console.log("SMx OLT inventory successful.");
  console.log(`Base URL: ${displaySmxBaseUrl(config)}`);
  console.log(`OLT records: ${olts.length}`);

  olts.forEach((olt, index) => {
    console.log(`OLT ${index + 1}: ${olt.provisionedOntCount} provisioned ONTs`);
  });

  console.log(`Total provisioned ONTs: ${countProvisionedOnts(olts)}`);

  const statusResponse = await findSampleStatus(client, olts);
  const levels = readOpticalLevels(statusResponse.data);

  console.log("Sample ONT status successful.");
  console.log(
    `ONT receive power (opt-signal-level): ${formatDbm(levels.ontReceiveDbm)}`,
  );
  console.log(
    `OLT receive power (ne-opt-signal-level): ${formatDbm(levels.oltReceiveDbm)}`,
  );
  console.log("No OLT names, ONT IDs, or subscriber details were printed.");
}

try {
  await main();
} catch (error) {
  process.exitCode = 1;

  if (error instanceof SmxConfigError) {
    console.error(`Configuration error: ${error.message}`);
  } else if (error instanceof SmxHttpError) {
    console.error(`SMx returned HTTP ${error.statusCode} during the ONT check.`);
  } else if (error instanceof Error && /certificate key too weak/i.test(error.message)) {
    console.error("Set SMX_TLS_SECURITY_LEVEL=1 in .env for this SMx certificate.");
  } else if (error instanceof Error && /self-signed certificate/i.test(error.message)) {
    console.error("Set SMX_ALLOW_SELF_SIGNED_CERT=true in .env for this SMx certificate.");
  } else if (error instanceof Error) {
    console.error(`ONT check failed: ${error.message}`);
  } else {
    console.error("ONT check failed for an unknown reason.");
  }
}
