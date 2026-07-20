import { geocodeMissingAddresses } from "./geocode-addresses.js";

geocodeMissingAddresses().catch((error) => {
  console.error(`Geocoding failed: ${error.message}`);
  process.exitCode = 1;
});
