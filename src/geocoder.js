export const CENSUS_BENCHMARK = "Public_AR_Current";
export const CENSUS_BATCH_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";

// Cleans one address part for matching and deduplication.
function cleanAddressPart(value) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toUpperCase()
    : "";
}

// Escapes one value for a CSV row.
function encodeCsvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// Creates a stable key for one service address.
export function createAddressKey(address) {
  const street = cleanAddressPart(address?.streetLine1);

  if (!street) {
    return null;
  }

  return [
    street,
    cleanAddressPart(address.city),
    cleanAddressPart(address.state),
    cleanAddressPart(address.zip),
    cleanAddressPart(address.country),
  ].join("|");
}

// Keeps one copy of each usable service address.
export function collectUniqueAddresses(records) {
  const addressesByKey = new Map();

  for (const record of records) {
    const key = createAddressKey(record.address);

    if (key && !addressesByKey.has(key)) {
      addressesByKey.set(key, { address: record.address, key });
    }
  }

  return [...addressesByKey.values()];
}

// Builds the CSV file and request IDs used by the Census batch API.
export function buildCensusBatch(entries) {
  const requests = entries.map((entry, index) => ({
    ...entry,
    id: String(index + 1),
  }));
  const csv = requests
    .map((request) =>
      [
        request.id,
        request.address.streetLine1,
        request.address.city,
        request.address.state,
        request.address.zip,
      ]
        .map(encodeCsvField)
        .join(","),
    )
    .join("\r\n");

  return {
    csv: csv ? `${csv}\r\n` : "",
    requests,
  };
}

// Parses CSV text while keeping quoted commas together.
export function parseCsv(csv) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field === "") {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("The Census geocoder returned invalid CSV.");
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((values) => values.some((value) => value !== ""));
}

// Reads longitude and latitude from one Census result.
function parseCoordinates(value) {
  const [longitude, latitude] = String(value ?? "")
    .split(",")
    .map(Number);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

// Converts the Census response into local cache entries.
export function parseCensusBatchResults(csv, requests, checkedAt = new Date()) {
  const rowsById = new Map(parseCsv(csv).map((row) => [row[0], row]));

  return requests.map((request) => {
    const row = rowsById.get(request.id);

    if (!row) {
      throw new Error(`The Census geocoder omitted result ${request.id}.`);
    }

    const matchStatus = row[2]?.trim() ?? "";
    const coordinates = parseCoordinates(row[5]);
    const matched = matchStatus.toLowerCase() === "match" && coordinates;

    return {
      checkedAt: checkedAt.toISOString(),
      key: request.key,
      latitude: matched ? coordinates.latitude : null,
      longitude: matched ? coordinates.longitude : null,
      matchedAddress: matched ? row[4]?.trim() || null : null,
      matchStatus: matchStatus || "Unknown",
      matchType: row[3]?.trim() || null,
      status: matched ? "matched" : "unmatched",
    };
  });
}

// Sends one batch of addresses to the Census geocoder.
export async function requestCensusGeocodes(entries, options = {}) {
  if (entries.length === 0) {
    return [];
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const checkedAt = options.checkedAt ?? new Date();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const { csv, requests } = buildCensusBatch(entries);
  const form = new FormData();

  form.append("addressFile", new Blob([csv], { type: "text/csv" }), "addresses.csv");
  form.append("benchmark", CENSUS_BENCHMARK);

  const response = await fetchImpl(CENSUS_BATCH_URL, {
    body: form,
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Census geocoder returned HTTP ${response.status}.`);
  }

  return parseCensusBatchResults(await response.text(), requests, checkedAt);
}
