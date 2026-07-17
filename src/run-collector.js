import {
  createCacheSnapshot,
  DEFAULT_CACHE_PATH,
  writeCacheSnapshot,
} from "./cache.js";
import { loadSmxConfig, SmxConfigError } from "./config.js";
import { collectLightLevels } from "./light-levels.js";
import { getGlobalOntInventory } from "./ont-inventory.js";
import { SmxClient, SmxHttpError } from "./smx-client.js";
import { getSubscribers, joinSubscribersToOnts } from "./subscribers.js";

// Pauses the scheduler between collection runs.
function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

// Prints progress every 25 ONTs and at the end.
function printProgress(progress) {
  if (progress.completed % 25 === 0 || progress.completed === progress.total) {
    console.log(
      `Collected ${progress.completed}/${progress.total} ` +
        `(ok: ${progress.succeeded}, failed: ${progress.failed})`,
    );
  }
}

// Runs one complete inventory and light-level collection.
async function runCollection(config) {
  const startedAt = Date.now();
  const client = new SmxClient(config);
  const subscribers = await getSubscribers(client);
  const onts = await getGlobalOntInventory(client);
  const rows = joinSubscribersToOnts(subscribers, onts);

  console.log(
    `Starting ${rows.length} ONT checks at ` +
      `${config.collectionRatePerMinute} calls per minute.`,
  );

  const records = await collectLightLevels(client, rows, {
    onProgress: printProgress,
    ratePerMinute: config.collectionRatePerMinute,
  });
  const snapshot = createCacheSnapshot(records);

  await writeCacheSnapshot(snapshot);

  console.log(`Cache written: ${DEFAULT_CACHE_PATH}`);
  console.log(
    `Collection finished in ${Math.round((Date.now() - startedAt) / 1000)} seconds.`,
  );
  console.log(
    `Results: ${snapshot.counts.successful} successful, ` +
      `${snapshot.counts.failed} failed.`,
  );
}

// Runs collections 15 minutes apart until the process stops.
async function runScheduler(config) {
  const intervalMs = config.collectionIntervalMinutes * 60_000;

  while (true) {
    const startedAt = Date.now();
    await runCollection(config);
    const waitMs = Math.max(0, intervalMs - (Date.now() - startedAt));

    console.log(
      `Next collection starts in ${Math.round(waitMs / 60_000)} minutes.`,
    );
    await sleep(waitMs);
  }
}

const runOnce = process.argv.includes("--once");

try {
  const config = loadSmxConfig();

  if (runOnce) {
    await runCollection(config);
  } else {
    await runScheduler(config);
  }
} catch (error) {
  process.exitCode = 1;

  if (error instanceof SmxConfigError) {
    console.error(`Configuration error: ${error.message}`);
  } else if (error instanceof SmxHttpError) {
    console.error(`SMx returned HTTP ${error.statusCode} during collection.`);
  } else if (error instanceof Error) {
    console.error(`Collection failed: ${error.message}`);
  } else {
    console.error("Collection failed for an unknown reason.");
  }
}
