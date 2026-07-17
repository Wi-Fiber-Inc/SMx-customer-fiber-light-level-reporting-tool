import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readCacheSnapshot } from "./cache.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultPublicPath = path.resolve(currentDirectory, "../public");

// Adds security headers to every web response.
function addSecurityHeaders(_request, response, next) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; " +
      "connect-src 'self'; img-src 'self'; object-src 'none'; " +
      "base-uri 'none'; frame-ancestors 'none'",
  );
  next();
}

// Sends the latest cached light-level report.
async function sendReport(response, readSnapshot) {
  try {
    response.json(await readSnapshot());
  } catch (error) {
    response.status(503).json({
      error: "cache-unavailable",
      message: "Run npm run smx:collect to create the report cache.",
    });
  }
}

// Builds the Express application without starting a listener.
export function createWebApp(options = {}) {
  const app = express();
  const publicPath = options.publicPath ?? defaultPublicPath;
  const readSnapshot = options.readSnapshot ?? readCacheSnapshot;

  app.disable("x-powered-by");
  app.use(addSecurityHeaders);
  app.get("/api/readings", (_request, response) => {
    void sendReport(response, readSnapshot);
  });
  app.use(express.static(publicPath, { index: "index.html" }));

  return app;
}
