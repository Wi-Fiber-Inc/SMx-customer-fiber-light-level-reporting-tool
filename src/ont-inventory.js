import { getAllPages } from "./pagination.js";

const OLT_FIELDS = "device-name,provisionedONTsCount";
const ONT_FIELDS = "device-name,ont-id,subscriber-id,serial-number";

// Converts an SMx count into a safe number.
function parseCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

// Converts an SMx optical value into dBm.
function parseDbm(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const dbm = Number(value);
  return Number.isFinite(dbm) ? dbm : null;
}

// Gets the managed OLTs and their provisioned ONT counts.
export async function getOltInventory(client) {
  const response = await client.get(
    `config/device?limit=100&fields=${OLT_FIELDS}`,
  );

  if (!Array.isArray(response.data)) {
    throw new Error("SMx returned an unexpected OLT inventory response.");
  }

  return response.data.map((device) => ({
    deviceName: device["device-name"] ?? device.name,
    provisionedOntCount: parseCount(device.provisionedONTsCount),
  }));
}

// Gets every ONT from the fast global inventory endpoint.
export async function getGlobalOntInventory(client) {
  const records = await getAllPages(client, "config/globalont", 100);

  return records.map((ont) => ({
    deviceName: ont["device-name"] ?? null,
    ontId: ont["ont-id"] ?? null,
    serialNumber: ont["serial-number"] ?? null,
    subscriberId: ont["subscriber-id"] ?? null,
  }));
}

// Gets one page of ONTs from a single OLT.
export async function getOntPage(client, deviceName, limit = 20, offset = 0) {
  const path =
    `config/device/${encodeURIComponent(deviceName)}/ont` +
    `?limit=${limit}&offset=${offset}&fields=${ONT_FIELDS}`;
  const response = await client.get(path);

  if (!Array.isArray(response.data)) {
    throw new Error("SMx returned an unexpected ONT inventory response.");
  }

  return response;
}

// Gets the live status for one ONT.
export function getOntStatus(client, deviceName, ontId) {
  const path =
    `performance/device/${encodeURIComponent(deviceName)}` +
    `/ont/${encodeURIComponent(ontId)}/status`;
  return client.get(path);
}

// Maps the SMx optical fields to the side receiving the signal.
export function readOpticalLevels(status) {
  return {
    ontReceiveDbm: parseDbm(status?.["opt-signal-level"]),
    oltReceiveDbm: parseDbm(status?.["ne-opt-signal-level"]),
    ontTransmitDbm: parseDbm(status?.["tx-opt-level"]),
  };
}

// Adds the provisioned ONT counts from every OLT.
export function countProvisionedOnts(olts) {
  return olts.reduce((total, olt) => total + olt.provisionedOntCount, 0);
}
