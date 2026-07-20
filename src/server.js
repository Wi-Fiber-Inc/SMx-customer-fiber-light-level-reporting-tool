import { loadWebConfig } from "./web-config.js";
import { startWebServer } from "./web-server.js";

startWebServer(loadWebConfig());
