import { loadSmxConfig, SmxConfigError } from "./config.js";
import { getGlobalOntInventory } from "./ont-inventory.js";
import { SmxClient, SmxHttpError } from "./smx-client.js";
import { getSubscribers, joinSubscribersToOnts } from "./subscribers.js";

// Counts joined rows that pass a simple check.
function countRows(rows, check) {
  return rows.filter(check).length;
}

// Counts extra copies of the same nonblank value.
function countDuplicateValues(values) {
  const seen = new Set();
  let duplicateCount = 0;

  for (const value of values) {
    if (!value) {
      continue;
    }

    if (seen.has(value)) {
      duplicateCount += 1;
    } else {
      seen.add(value);
    }
  }

  return duplicateCount;
}

// Runs the subscriber, address, and ONT join check.
async function main() {
  const client = new SmxClient(loadSmxConfig());
  const subscribers = await getSubscribers(client);
  const onts = await getGlobalOntInventory(client);
  const rows = joinSubscribersToOnts(subscribers, onts);
  const subscriberAccountIds = subscribers.map(
    (subscriber) => subscriber.accountId,
  );
  const ontSubscriberIds = onts.map((ont) => ont.subscriberId);
  const matchedAccountIds = new Set(
    rows.filter((row) => row.matchedSubscriber).map((row) => row.accountId),
  );
  const subscribersWithoutOnt = subscribers.filter(
    (subscriber) =>
      subscriber.accountId && !matchedAccountIds.has(subscriber.accountId),
  ).length;

  console.log("SMx subscriber join successful.");
  console.log(`Subscriber records: ${subscribers.length}`);
  console.log(`Global ONT records: ${onts.length}`);
  console.log(
    `Subscribers missing an account ID: ${subscriberAccountIds.filter((value) => !value).length}`,
  );
  console.log(
    `Duplicate subscriber account records: ${countDuplicateValues(subscriberAccountIds)}`,
  );
  console.log(
    `ONTs missing a subscriber ID: ${ontSubscriberIds.filter((value) => !value).length}`,
  );
  console.log(
    `Extra ONTs sharing a subscriber ID: ${countDuplicateValues(ontSubscriberIds)}`,
  );
  console.log(
    `ONTs matched to subscribers: ${countRows(rows, (row) => row.matchedSubscriber)}`,
  );
  console.log(
    `Matched ONTs with an address: ${countRows(rows, (row) => row.matchedSubscriber && row.address !== null)}`,
  );
  console.log(
    `Matched ONTs missing an address: ${countRows(rows, (row) => row.matchedSubscriber && row.address === null)}`,
  );
  console.log(
    `ONTs missing a subscriber match: ${countRows(rows, (row) => !row.matchedSubscriber)}`,
  );
  console.log(`Subscribers missing an ONT match: ${subscribersWithoutOnt}`);
  console.log("No account IDs, addresses, names, contacts, or ONT IDs were printed.");
}

try {
  await main();
} catch (error) {
  process.exitCode = 1;

  if (error instanceof SmxConfigError) {
    console.error(`Configuration error: ${error.message}`);
  } else if (error instanceof SmxHttpError) {
    console.error(`SMx returned HTTP ${error.statusCode} during the join check.`);
  } else if (error instanceof Error) {
    console.error(`Subscriber join failed: ${error.message}`);
  } else {
    console.error("Subscriber join failed for an unknown reason.");
  }
}
