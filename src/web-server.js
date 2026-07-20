import { createWebApp } from "./web-app.js";

// Starts the Express report server with the supplied web settings.
export function startWebServer(config) {
  const app = createWebApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`SMx report: http://${config.host}:${config.port}`);
    console.log("Press Ctrl+C to stop the server.");
  });

  server.on("error", (error) => {
    console.error(`Web server failed: ${error.message}`);
    process.exitCode = 1;
  });

  return server;
}
