import { getOntStatus, readOpticalLevels } from "./ont-inventory.js";
import { RateLimiter } from "./rate-limiter.js";
import { SmxHttpError } from "./smx-client.js";

const HEALTH_SEVERITY = {
  healthy: 0,
  warning: 1,
  critical: 2,
  "no-signal": 3,
};

// Leaves progress reporting off when no callback is supplied.
function ignoreProgress() {}

// Places ONT rows into one serial queue per OLT.
function groupRowsByOlt(rows) {
  const groups = new Map();

  rows.forEach((row, index) => {
    const groupName = row.deviceName ?? "missing-olt";
    const group = groups.get(groupName) ?? [];
    group.push({ index, row });
    groups.set(groupName, group);
  });

  return [...groups.values()];
}

// Converts a failed status request into a short cache error.
function getCollectionError(error) {
  if (error instanceof SmxHttpError) {
    return `http-${error.statusCode}`;
  }

  if (error instanceof Error && /did not respond within/i.test(error.message)) {
    return "timeout";
  }

  return "request-failed";
}

// Rates one receive-power reading using the agreed bands.
export function getReadingHealth(value) {
  if (value === null || value <= -30) {
    return "no-signal";
  }

  if (value <= -28) {
    return "critical";
  }

  if (value <= -25) {
    return "warning";
  }

  return "healthy";
}

// Uses the worse status from the ONT and OLT readings.
export function getOverallHealth(ontHealth, oltHealth) {
  return HEALTH_SEVERITY[ontHealth] >= HEALTH_SEVERITY[oltHealth]
    ? ontHealth
    : oltHealth;
}

// Collects one ONT and returns a cache-safe record.
async function collectOneOnt(client, entry, limiter) {
  const { index, row } = entry;

  if (!row.deviceName || !row.ontId) {
    return {
      index,
      record: {
        ...row,
        collectedAt: new Date().toISOString(),
        error: "missing-ont-identifiers",
        oltHealth: "no-signal",
        oltReceiveDbm: null,
        ontHealth: "no-signal",
        ontReceiveDbm: null,
        overallHealth: "no-signal",
      },
    };
  }

  await limiter.wait();

  try {
    const response = await getOntStatus(client, row.deviceName, row.ontId);
    const levels = readOpticalLevels(response.data);
    const ontHealth = getReadingHealth(levels.ontReceiveDbm);
    const oltHealth = getReadingHealth(levels.oltReceiveDbm);
    const hasReading =
      levels.ontReceiveDbm !== null || levels.oltReceiveDbm !== null;

    return {
      index,
      record: {
        ...row,
        collectedAt: new Date().toISOString(),
        error: hasReading ? null : "missing-optical-levels",
        oltHealth,
        oltReceiveDbm: levels.oltReceiveDbm,
        ontHealth,
        ontReceiveDbm: levels.ontReceiveDbm,
        overallHealth: getOverallHealth(ontHealth, oltHealth),
      },
    };
  } catch (error) {
    return {
      index,
      record: {
        ...row,
        collectedAt: new Date().toISOString(),
        error: getCollectionError(error),
        oltHealth: "no-signal",
        oltReceiveDbm: null,
        ontHealth: "no-signal",
        ontReceiveDbm: null,
        overallHealth: "no-signal",
      },
    };
  }
}

// Runs one OLT queue in order and reports progress.
async function collectOltGroup(client, group, limiter, progress) {
  const results = [];

  for (const entry of group) {
    const result = await collectOneOnt(client, entry, limiter);
    results.push(result);
    progress.completed += 1;

    if (result.record.error) {
      progress.failed += 1;
    } else {
      progress.succeeded += 1;
    }

    progress.onProgress({
      completed: progress.completed,
      failed: progress.failed,
      succeeded: progress.succeeded,
      total: progress.total,
    });
  }

  return results;
}

// Collects every ONT with one serial worker per OLT.
export async function collectLightLevels(client, rows, options = {}) {
  const limiter =
    options.limiter ?? new RateLimiter(options.ratePerMinute ?? 240);
  const groups = groupRowsByOlt(rows);
  const progress = {
    completed: 0,
    failed: 0,
    onProgress: options.onProgress ?? ignoreProgress,
    succeeded: 0,
    total: rows.length,
  };
  const groupedResults = await Promise.all(
    groups.map((group) => collectOltGroup(client, group, limiter, progress)),
  );

  return groupedResults
    .flat()
    .sort((left, right) => left.index - right.index)
    .map((result) => result.record);
}
