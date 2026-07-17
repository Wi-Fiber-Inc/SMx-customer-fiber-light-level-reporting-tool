import { request as httpsRequest } from "node:https";

export class SmxHttpError extends Error {
  // Builds an error for a bad HTTP status.
  constructor(statusCode, requestPath) {
    super(`SMx returned HTTP ${statusCode} for GET ${requestPath}.`);
    this.name = "SmxHttpError";
    this.statusCode = statusCode;
    this.requestPath = requestPath;
  }
}

export class SmxResponseError extends Error {
  // Builds an error for a bad JSON response.
  constructor(message) {
    super(message);
    this.name = "SmxResponseError";
  }
}

// Joins the SMx base URL with an API path.
export function createSmxUrl(baseUrl, requestPath) {
  const relativePath = requestPath.replace(/^\/+/, "");
  return new URL(relativePath, baseUrl);
}

// Reads the total record count from an SMx header.
function parseTotalCount(header) {
  const rawValue = Array.isArray(header) ? header[0] : header;

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export class SmxClient {
  #config;

  // Saves the connection settings for this client.
  constructor(config) {
    this.#config = config;
  }

  // Sends a read-only GET request to SMx.
  async get(requestPath) {
    const url = createSmxUrl(this.#config.baseUrl, requestPath);
    const startedAt = Date.now();

    // Wraps the HTTPS request so callers can await it.
    return new Promise((resolve, reject) => {
      const request = httpsRequest(
        url,
        {
          method: "GET",
          auth: `${this.#config.username}:${this.#config.password}`,
          headers: {
            Accept: "application/json",
            "User-Agent": "smx-light-level-report/0.1.0",
          },
          ciphers: `DEFAULT@SECLEVEL=${this.#config.tlsSecurityLevel}`,
          rejectUnauthorized: !this.#config.allowSelfSignedCertificate,
        },
        // Handles the response returned by SMx.
        (response) => {
          const chunks = [];

          // Saves each response chunk until the body is complete.
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("error", reject);
          // Checks the status and parses the completed response.
          response.on("end", () => {
            const statusCode = response.statusCode ?? 0;

            if (statusCode < 200 || statusCode >= 300) {
              reject(new SmxHttpError(statusCode, url.pathname));
              return;
            }

            const body = Buffer.concat(chunks).toString("utf8").trim();

            try {
              const data = body ? JSON.parse(body) : null;

              resolve({
                data,
                durationMs: Date.now() - startedAt,
                statusCode,
                totalCount: parseTotalCount(response.headers["x-total-count"]),
              });
            } catch {
              reject(
                new SmxResponseError(
                  `SMx returned a successful response for GET ${url.pathname}, but the body was not valid JSON.`,
                ),
              );
            }
          });
        },
      );

      // Stops a request that takes too long.
      request.setTimeout(this.#config.requestTimeoutMs, () => {
        request.destroy(
          new Error(
            `SMx did not respond within ${this.#config.requestTimeoutMs} ms.`,
          ),
        );
      });

      request.on("error", reject);
      request.end();
    });
  }
}
