const DEFAULT_BASE_URL = "https://10.100.100.220:18443/rest/v1";
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_COLLECTION_INTERVAL_MINUTES = 15;
const DEFAULT_COLLECTION_RATE_PER_MINUTE = 240;

export class SmxConfigError extends Error {
  // Builds an error for a bad SMx setting.
  constructor(message) {
    super(message);
    this.name = "SmxConfigError";
  }
}

// Reads a required setting from the environment.
function readRequired(environment, name) {
  const value = environment[name]?.trim();

  if (!value) {
    throw new SmxConfigError(
      `${name} is required. Copy .env.example to .env and fill in the SMx credentials.`,
    );
  }

  return value;
}

// Converts a true or false setting into a boolean.
function readBoolean(environment, name, defaultValue) {
  const value = environment[name]?.trim().toLowerCase();

  if (!value) {
    return defaultValue;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new SmxConfigError(`${name} must be either true or false.`);
}

// Reads and checks the SMx request timeout.
function readRequestTimeout(environment) {
  const rawValue = environment.SMX_REQUEST_TIMEOUT_MS?.trim();

  if (!rawValue) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1_000 || value > 60_000) {
    throw new SmxConfigError(
      "SMX_REQUEST_TIMEOUT_MS must be a whole number from 1000 through 60000.",
    );
  }

  return value;
}

// Reads the number of minutes between full collections.
function readCollectionInterval(environment) {
  const rawValue = environment.SMX_COLLECTION_INTERVAL_MINUTES?.trim();

  if (!rawValue) {
    return DEFAULT_COLLECTION_INTERVAL_MINUTES;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1 || value > 1440) {
    throw new SmxConfigError(
      "SMX_COLLECTION_INTERVAL_MINUTES must be from 1 through 1440.",
    );
  }

  return value;
}

// Reads the maximum number of SMx calls started each minute.
function readCollectionRate(environment) {
  const rawValue = environment.SMX_COLLECTION_RATE_PER_MINUTE?.trim();

  if (!rawValue) {
    return DEFAULT_COLLECTION_RATE_PER_MINUTE;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1 || value > 300) {
    throw new SmxConfigError(
      "SMX_COLLECTION_RATE_PER_MINUTE must be from 1 through 300.",
    );
  }

  return value;
}

// Reads the OpenSSL security level used for SMx.
function readTlsSecurityLevel(environment) {
  const rawValue = environment.SMX_TLS_SECURITY_LEVEL?.trim();

  if (!rawValue) {
    return 2;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 0 || value > 2) {
    throw new SmxConfigError(
      "SMX_TLS_SECURITY_LEVEL must be 0, 1, or 2.",
    );
  }

  return value;
}

// Builds and cleans up the SMx base URL.
function readBaseUrl(environment) {
  let baseUrl;

  try {
    baseUrl = new URL(environment.SMX_BASE_URL?.trim() || DEFAULT_BASE_URL);
  } catch {
    throw new SmxConfigError("SMX_BASE_URL must be a valid URL.");
  }

  if (baseUrl.protocol !== "https:") {
    throw new SmxConfigError("SMX_BASE_URL must use HTTPS.");
  }

  baseUrl.username = "";
  baseUrl.password = "";
  baseUrl.search = "";
  baseUrl.hash = "";
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}/`;

  return baseUrl;
}

// Loads every setting used by the SMx client.
export function loadSmxConfig(environment = process.env) {
  const username = readRequired(environment, "SMX_USERNAME");

  if (username.includes(":")) {
    throw new SmxConfigError(
      "SMX_USERNAME cannot contain a colon when using HTTP Basic authentication.",
    );
  }

  return {
    baseUrl: readBaseUrl(environment),
    username,
    password: readRequired(environment, "SMX_PASSWORD"),
    collectionIntervalMinutes: readCollectionInterval(environment),
    collectionRatePerMinute: readCollectionRate(environment),
    allowSelfSignedCertificate: readBoolean(
      environment,
      "SMX_ALLOW_SELF_SIGNED_CERT",
      false,
    ),
    tlsSecurityLevel: readTlsSecurityLevel(environment),
    requestTimeoutMs: readRequestTimeout(environment),
  };
}

// Formats the SMx URL for console output.
export function displaySmxBaseUrl(config) {
  return config.baseUrl.toString().replace(/\/$/, "");
}
