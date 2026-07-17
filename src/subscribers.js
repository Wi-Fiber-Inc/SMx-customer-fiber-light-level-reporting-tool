import { getAllPages } from "./pagination.js";

// Trims a text field and turns blanks into null.
function cleanText(value) {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim() || null;
}

// Picks the primary subscriber location when one is marked.
function getPrimaryLocation(locations) {
  if (!Array.isArray(locations) || locations.length === 0) {
    return null;
  }

  return locations.find((location) => location.primary === true) ?? locations[0];
}

// Keeps only the address fields needed by the report.
function normalizeAddress(locations) {
  const location = getPrimaryLocation(locations);
  const address = Array.isArray(location?.address) ? location.address[0] : null;
  const streetLine1 = cleanText(address?.streetLine1);

  if (!streetLine1) {
    return null;
  }

  return {
    streetLine1,
    city: cleanText(address.city),
    state: cleanText(address.state),
    zip: cleanText(address.zip),
    country: cleanText(address.country),
  };
}

// Keeps the subscriber account ID and primary address only.
export function normalizeSubscriber(subscriber) {
  return {
    accountId: cleanText(subscriber?.customId),
    address: normalizeAddress(subscriber?.locations),
  };
}

// Gets every subscriber without keeping names or contacts.
export async function getSubscribers(client) {
  const records = await getAllPages(client, "ems/subscriber", 100);
  return records.map(normalizeSubscriber);
}

// Joins each ONT to the subscriber with the same account ID.
export function joinSubscribersToOnts(subscribers, onts) {
  const subscribersByAccount = new Map(
    subscribers
      .filter((subscriber) => subscriber.accountId)
      .map((subscriber) => [subscriber.accountId, subscriber]),
  );

  return onts.map((ont) => {
    const subscriber = subscribersByAccount.get(ont.subscriberId) ?? null;

    return {
      accountId: ont.subscriberId,
      address: subscriber?.address ?? null,
      deviceName: ont.deviceName,
      matchedSubscriber: subscriber !== null,
      ontId: ont.ontId,
      serialNumber: ont.serialNumber,
    };
  });
}
