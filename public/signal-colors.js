const NO_READING_COLOR = "#475467";
const SIGNAL_COLOR_STOPS = [
  { color: "#b42318", value: -30 },
  { color: "#d92d20", value: -28 },
  { color: "#f79009", value: -25 },
  { color: "#65a30d", value: -20 },
  { color: "#067647", value: -15 },
];

// Converts a hex color into RGB values.
function hexToRgb(hex) {
  return {
    blue: Number.parseInt(hex.slice(5, 7), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    red: Number.parseInt(hex.slice(1, 3), 16),
  };
}

// Converts RGB values into a hex color.
function rgbToHex(red, green, blue) {
  return `#${[red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

// Blends between two map marker colors.
function blendColors(leftColor, rightColor, amount) {
  const left = hexToRgb(leftColor);
  const right = hexToRgb(rightColor);

  return rgbToHex(
    left.red + (right.red - left.red) * amount,
    left.green + (right.green - left.green) * amount,
    left.blue + (right.blue - left.blue) * amount,
  );
}

// Returns a marker color for one valid receive-power value.
export function getSignalColor(value) {
  if (!Number.isFinite(value) || value === 0) {
    return NO_READING_COLOR;
  }

  if (value <= SIGNAL_COLOR_STOPS[0].value) {
    return SIGNAL_COLOR_STOPS[0].color;
  }

  const lastStop = SIGNAL_COLOR_STOPS.at(-1);

  if (value >= lastStop.value) {
    return lastStop.color;
  }

  for (let index = 1; index < SIGNAL_COLOR_STOPS.length; index += 1) {
    const right = SIGNAL_COLOR_STOPS[index];

    if (value <= right.value) {
      const left = SIGNAL_COLOR_STOPS[index - 1];
      const amount = (value - left.value) / (right.value - left.value);
      return blendColors(left.color, right.color, amount);
    }
  }

  return lastStop.color;
}

// Returns the worse valid receive power from one report record.
export function getWorstReceivePower(record) {
  const readings = [record.ontReceiveDbm, record.oltReceiveDbm];

  if (
    record.error ||
    readings.some((value) => !Number.isFinite(value) || value === 0)
  ) {
    return null;
  }

  return Math.min(...readings);
}

// Returns the solid map marker color for one report record.
export function getMarkerColor(record) {
  return getSignalColor(getWorstReceivePower(record));
}
