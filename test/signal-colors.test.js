import assert from "node:assert/strict";
import test from "node:test";

import {
  getMarkerColor,
  getSignalColor,
  getWorstReceivePower,
} from "../public/signal-colors.js";

// Checks the fixed values and clamping used by the map spectrum.
test("colors receive-power values across the map spectrum", () => {
  assert.equal(getSignalColor(-35), "#b42318");
  assert.equal(getSignalColor(-30), "#b42318");
  assert.equal(getSignalColor(-25), "#f79009");
  assert.equal(getSignalColor(-15), "#067647");
  assert.equal(getSignalColor(-10), "#067647");
  assert.match(getSignalColor(-26.5), /^#[0-9a-f]{6}$/);
});

// Checks that the worse ONT or OLT reading drives the marker.
test("uses the worse valid receive power for marker color", () => {
  const record = {
    error: null,
    oltReceiveDbm: -18,
    ontReceiveDbm: -23,
  };

  assert.equal(getWorstReceivePower(record), -23);
  assert.equal(getMarkerColor(record), getSignalColor(-23));
});

// Checks that unavailable readings stay gray on the map.
test("keeps unavailable map readings gray", () => {
  assert.equal(
    getMarkerColor({ error: null, oltReceiveDbm: 0, ontReceiveDbm: 0 }),
    "#475467",
  );
  assert.equal(
    getMarkerColor({
      error: "http-500",
      oltReceiveDbm: null,
      ontReceiveDbm: null,
    }),
    "#475467",
  );
});
