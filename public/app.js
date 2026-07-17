import {
  getMarkerColor,
  getSignalColor,
  getWorstReceivePower,
} from "./signal-colors.js";

const PAGE_SIZE = 50;
const state = {
  currentPage: 1,
  filteredRecords: [],
  fitMapOnNextRender: true,
  map: null,
  mapLayer: null,
  records: [],
  snapshot: null,
  view: "map",
};

const elements = {
  clearButton: document.querySelector("#clear-button"),
  collectionTime: document.querySelector("#collection-time"),
  criticalCount: document.querySelector("#critical-count"),
  errorBanner: document.querySelector("#error-banner"),
  errorCount: document.querySelector("#error-count"),
  healthFilter: document.querySelector("#health-filter"),
  healthyCount: document.querySelector("#healthy-count"),
  nextButton: document.querySelector("#next-button"),
  mapCount: document.querySelector("#map-count"),
  mapView: document.querySelector("#map-view"),
  mapViewButton: document.querySelector("#map-view-button"),
  noSignalCount: document.querySelector("#no-signal-count"),
  pageLabel: document.querySelector("#page-label"),
  pagination: document.querySelector("#pagination"),
  previousButton: document.querySelector("#previous-button"),
  reloadButton: document.querySelector("#reload-button"),
  reportBody: document.querySelector("#report-body"),
  resultCount: document.querySelector("#result-count"),
  searchInput: document.querySelector("#search-input"),
  tableView: document.querySelector("#table-view"),
  tableViewButton: document.querySelector("#table-view-button"),
  totalCount: document.querySelector("#total-count"),
  warningCount: document.querySelector("#warning-count"),
};

// Formats one receive-power value for the table.
function formatDbm(value) {
  return typeof value === "number" ? `${value.toFixed(2)} dBm` : "—";
}

// Formats the service address without adding blank parts.
function formatAddress(address) {
  if (!address) {
    return "Address unavailable";
  }

  const cityLine = [address.city, address.state, address.zip]
    .filter(Boolean)
    .join(", ")
    .replace(", ,", ",");

  return [address.streetLine1, cityLine].filter(Boolean).join(" · ");
}

// Formats an ISO timestamp in the browser's local time.
function formatTimestamp(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

// Uses API error when the reading could not be collected.
function getDisplayStatus(record) {
  return record.error ? "error" : record.overallHealth;
}

// Converts a status value into a readable label.
function formatStatus(status) {
  const labels = {
    critical: "Critical",
    error: "API error",
    healthy: "Healthy",
    "no-signal": "No signal",
    warning: "Warning",
  };

  return labels[status] ?? "Unknown";
}

// Creates a stable browser-side key for one address.
function getAddressKey(address) {
  if (!address?.streetLine1) {
    return null;
  }

  return [
    address.streetLine1,
    address.city,
    address.state,
    address.zip,
    address.country,
  ]
    .map((value) => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase())
    .join("|");
}

// Picks the worst reading for an address marker.
function getWorstRecord(records) {
  const priority = {
    healthy: 0,
    warning: 1,
    critical: 2,
    "no-signal": 3,
    error: 4,
  };

  return records.reduce((worst, record) => {
    const recordPriority = priority[getDisplayStatus(record)];
    const worstPriority = priority[getDisplayStatus(worst)];

    if (recordPriority !== worstPriority) {
      return recordPriority > worstPriority ? record : worst;
    }

    const recordPower = getWorstReceivePower(record);
    const worstPower = getWorstReceivePower(worst);

    if (recordPower === null) {
      return worstPower === null ? worst : record;
    }

    return worstPower === null || recordPower >= worstPower ? worst : record;
  });
}

// Groups filtered rows into one marker per service address.
function groupMapRecords(records) {
  const mappedByAddress = new Map();
  const unmatchedAddresses = new Set();
  let missingAddressRecords = 0;

  for (const record of records) {
    const key = getAddressKey(record.address);
    const hasLocation =
      Number.isFinite(record.location?.latitude) &&
      Number.isFinite(record.location?.longitude);

    if (!key) {
      missingAddressRecords += 1;
    } else if (!hasLocation) {
      unmatchedAddresses.add(key);
    } else if (mappedByAddress.has(key)) {
      mappedByAddress.get(key).push(record);
    } else {
      mappedByAddress.set(key, [record]);
    }
  }

  return {
    mappedGroups: [...mappedByAddress.values()],
    missingAddressRecords,
    unmatchedAddresses: unmatchedAddresses.size,
  };
}

// Adds one label and value to a marker popup.
function addPopupLine(popup, label, value) {
  const line = document.createElement("p");
  line.textContent = `${label}: ${value}`;
  popup.append(line);
}

// Builds the details shown when a marker is selected.
function createMapPopup(records) {
  const worstRecord = getWorstRecord(records);
  const popup = document.createElement("div");
  const address = document.createElement("strong");

  popup.className = "map-popup";
  address.textContent = formatAddress(worstRecord.address);
  popup.append(address);
  addPopupLine(popup, "Status", formatStatus(getDisplayStatus(worstRecord)));
  addPopupLine(popup, "ONT Rx", formatDbm(worstRecord.ontReceiveDbm));
  addPopupLine(popup, "OLT Rx", formatDbm(worstRecord.oltReceiveDbm));
  addPopupLine(
    popup,
    "Worst Rx",
    formatDbm(getWorstReceivePower(worstRecord)),
  );
  addPopupLine(popup, "ONTs", records.length);
  return popup;
}

// Colors the receive-power dots shown below the map.
function renderMapLegend() {
  for (const dot of document.querySelectorAll("[data-signal-value]")) {
    dot.style.backgroundColor = getSignalColor(Number(dot.dataset.signalValue));
  }
}

// Starts the local Leaflet map and OpenStreetMap layer.
function initializeMap() {
  state.map = window.L.map("network-map", {
    preferCanvas: true,
    zoomControl: true,
  }).setView([30.23, -98.38], 9);
  window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    keepBuffer: 1,
    maxZoom: 19,
    updateWhenIdle: true,
  }).addTo(state.map);
  state.mapLayer = window.L.layerGroup().addTo(state.map);
}

// Draws filtered address markers and updates map coverage.
function renderMap() {
  const groups = groupMapRecords(state.filteredRecords);
  const bounds = [];

  state.mapLayer.clearLayers();

  for (const records of groups.mappedGroups) {
    const worstRecord = getWorstRecord(records);
    const location = worstRecord.location;
    const color = getMarkerColor(worstRecord);
    const marker = window.L.circleMarker(
      [location.latitude, location.longitude],
      {
        color,
        fillColor: color,
        fillOpacity: 1,
        radius: 6,
        weight: 2,
      },
    );

    marker.bindPopup(createMapPopup(records));
    marker.addTo(state.mapLayer);
    bounds.push([location.latitude, location.longitude]);
  }

  elements.mapCount.textContent =
    `${groups.mappedGroups.length} mapped addresses · ` +
    `${groups.unmatchedAddresses} unmatched · ` +
    `${groups.missingAddressRecords} records without an address`;

  if (state.fitMapOnNextRender && bounds.length > 0) {
    state.map.fitBounds(bounds, {
      animate: false,
      maxZoom: 16,
      padding: [24, 24],
    });
  }

  state.fitMapOnNextRender = false;
}

// Shows the selected report view.
function renderView() {
  const mapActive = state.view === "map";

  elements.mapView.hidden = !mapActive;
  elements.tableView.hidden = mapActive;
  elements.pagination.hidden = mapActive;
  elements.mapViewButton.classList.toggle("active-view-button", mapActive);
  elements.tableViewButton.classList.toggle("active-view-button", !mapActive);
  elements.mapViewButton.setAttribute("aria-pressed", String(mapActive));
  elements.tableViewButton.setAttribute("aria-pressed", String(!mapActive));

  if (mapActive) {
    setTimeout(() => state.map.invalidateSize(), 0);
  }
}

// Builds the text searched for each report row.
function getSearchText(record) {
  return [
    formatAddress(record.address),
    record.accountId,
    record.ontId,
    record.serialNumber,
    record.deviceName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// Applies the current search and status filters.
function applyFilters() {
  const search = elements.searchInput.value.trim().toLowerCase();
  const health = elements.healthFilter.value;

  state.filteredRecords = state.records.filter((record) => {
    const matchesSearch = !search || getSearchText(record).includes(search);
    const matchesHealth =
      health === "all" || getDisplayStatus(record) === health;
    return matchesSearch && matchesHealth;
  });
}

// Writes the cache summary into the status cards.
function renderSummary() {
  const counts = state.snapshot?.counts;

  elements.totalCount.textContent = counts?.total ?? "—";
  elements.healthyCount.textContent = counts?.healthy ?? "—";
  elements.warningCount.textContent = counts?.warning ?? "—";
  elements.criticalCount.textContent = counts?.critical ?? "—";
  elements.noSignalCount.textContent = counts?.noSignal ?? "—";
  elements.errorCount.textContent = counts?.failed ?? "—";
  elements.collectionTime.textContent = state.snapshot
    ? `Last collection: ${formatTimestamp(state.snapshot.generatedAt)}`
    : "Cache unavailable";
}

// Creates one text table cell.
function createCell(value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = value;

  if (className) {
    cell.className = className;
  }

  return cell;
}

// Creates the colored status cell for one row.
function createStatusCell(record) {
  const status = getDisplayStatus(record);
  const cell = document.createElement("td");
  const badge = document.createElement("span");

  badge.className = `status-badge status-${status}`;
  badge.textContent = formatStatus(status);
  cell.append(badge);
  return cell;
}

// Renders the current page of report rows.
function renderRows() {
  const start = (state.currentPage - 1) * PAGE_SIZE;
  const rows = state.filteredRecords.slice(start, start + PAGE_SIZE);

  elements.reportBody.replaceChildren();

  if (rows.length === 0) {
    const row = document.createElement("tr");
    const cell = createCell("No records match the current filters.", "empty-cell");
    cell.colSpan = 9;
    row.append(cell);
    elements.reportBody.append(row);
    return;
  }

  for (const record of rows) {
    const row = document.createElement("tr");
    row.append(
      createStatusCell(record),
      createCell(formatAddress(record.address), "address-cell"),
      createCell(record.accountId ?? "—", "mono-cell"),
      createCell(record.ontId ?? "—", "mono-cell"),
      createCell(record.deviceName ?? "—", "olt-cell"),
      createCell(formatDbm(record.ontReceiveDbm), "number-column mono-cell"),
      createCell(formatDbm(record.oltReceiveDbm), "number-column mono-cell"),
      createCell(formatTimestamp(record.collectedAt), "time-cell"),
      createCell(record.error ?? "—", record.error ? "error-text" : "muted-text"),
    );
    elements.reportBody.append(row);
  }
}

// Updates result counts and page controls.
function renderPager() {
  const pageCount = Math.max(1, Math.ceil(state.filteredRecords.length / PAGE_SIZE));
  const start = state.filteredRecords.length
    ? (state.currentPage - 1) * PAGE_SIZE + 1
    : 0;
  const end = Math.min(
    state.currentPage * PAGE_SIZE,
    state.filteredRecords.length,
  );

  state.currentPage = Math.min(state.currentPage, pageCount);
  elements.resultCount.textContent =
    `Showing ${start}–${end} of ${state.filteredRecords.length} records`;
  elements.pageLabel.textContent = `Page ${state.currentPage} of ${pageCount}`;
  elements.previousButton.disabled = state.currentPage === 1;
  elements.nextButton.disabled = state.currentPage === pageCount;
}

// Renders all report sections from the current state.
function render() {
  applyFilters();
  renderSummary();
  renderPager();
  renderRows();
  renderMap();
  renderView();
}

// Loads the newest cache snapshot from Express.
async function loadReport() {
  elements.reloadButton.disabled = true;
  elements.errorBanner.hidden = true;

  try {
    const response = await fetch("/api/readings", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message ?? "The report cache is unavailable.");
    }

    state.snapshot = payload;
    state.records = payload.records ?? [];
    state.currentPage = 1;
    render();
  } catch (error) {
    elements.errorBanner.textContent = error.message;
    elements.errorBanner.hidden = false;
  } finally {
    elements.reloadButton.disabled = false;
  }
}

// Resets the page when the search text changes.
function handleSearch() {
  state.currentPage = 1;
  state.fitMapOnNextRender = true;
  render();
}

// Resets the page when the status filter changes.
function handleFilter() {
  state.currentPage = 1;
  state.fitMapOnNextRender = true;
  render();
}

// Clears both report filters.
function handleClear() {
  elements.searchInput.value = "";
  elements.healthFilter.value = "all";
  state.currentPage = 1;
  state.fitMapOnNextRender = true;
  render();
  elements.searchInput.focus();
}

// Moves to the previous report page.
function handlePrevious() {
  if (state.currentPage > 1) {
    state.currentPage -= 1;
    renderPager();
    renderRows();
  }
}

// Moves to the next report page.
function handleNext() {
  const pageCount = Math.ceil(state.filteredRecords.length / PAGE_SIZE);

  if (state.currentPage < pageCount) {
    state.currentPage += 1;
    renderPager();
    renderRows();
  }
}

// Reloads the cache when the button is clicked.
function handleReload() {
  void loadReport();
}

// Switches the report to the map.
function handleMapView() {
  state.view = "map";
  renderView();
}

// Switches the report to the table.
function handleTableView() {
  state.view = "table";
  renderView();
}

// Connects controls and loads the first report.
function start() {
  initializeMap();
  renderMapLegend();
  elements.searchInput.addEventListener("input", handleSearch);
  elements.healthFilter.addEventListener("change", handleFilter);
  elements.clearButton.addEventListener("click", handleClear);
  elements.previousButton.addEventListener("click", handlePrevious);
  elements.nextButton.addEventListener("click", handleNext);
  elements.reloadButton.addEventListener("click", handleReload);
  elements.mapViewButton.addEventListener("click", handleMapView);
  elements.tableViewButton.addEventListener("click", handleTableView);
  void loadReport();
  setInterval(loadReport, 60_000);
}

document.addEventListener("DOMContentLoaded", start);
