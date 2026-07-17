const DEFAULT_WEB_HOST = "127.0.0.1";
const DEFAULT_WEB_PORT = 3000;

// Reads the local address used by the Express server.
function readWebHost(environment) {
  return environment.WEB_HOST?.trim() || DEFAULT_WEB_HOST;
}

// Reads and checks the Express server port.
function readWebPort(environment) {
  const rawValue = environment.WEB_PORT?.trim();

  if (!rawValue) {
    return DEFAULT_WEB_PORT;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error("WEB_PORT must be a whole number from 1 through 65535.");
  }

  return value;
}

// Loads the settings used by the local Express server.
export function loadWebConfig(environment = process.env) {
  return {
    host: readWebHost(environment),
    port: readWebPort(environment),
  };
}
