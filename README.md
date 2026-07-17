# SMx Customer Fiber Light-Level Reporting Tool

A read-only Node.js tool for associating Calix SMx subscriber addresses with
XGS-PON ONT and OLT receive power. The first deliverable will be a searchable
report; address mapping comes after the report data is verified.

## Address geocoding

The geocoding command sends each unique service address to the U.S. Census
batch geocoder and stores the result in `data/geocode-cache.json`. Account IDs,
ONT IDs, names, and contacts are not sent. Existing cache entries are reused,
so the same address is not submitted again during normal runs.

Run geocoding manually with:

```powershell
npm run geocode
```

The Census coordinates are interpolated from street address ranges. They are
appropriate for an operational overview map, but they should not be treated as
survey-grade property coordinates. Unmatched addresses remain in the cache so
they can be reviewed without repeated submissions.

## Map view

The Express report opens on an interactive map and keeps the table available
through the Map and Table buttons. The map:

- Draws one marker per matched service address
- Uses the worst ONT status when multiple ONTs share an address
- Colors only the marker fill using the worse ONT or OLT receive power
- Applies the same search and status filters as the table
- Shows the address, status, ONT receive power, and OLT receive power on click
- Reports matched, unmatched, and missing-address counts below the map

Map tiles come from OpenStreetMap and are requested only for the area currently
visible in the browser. Subscriber markers and report data stay inside this
application.

## Current iteration: searchable Express report

The local Express application reads the latest cache and never queries SMx when
a page loads or a search runs. Start it with:

```powershell
npm run web
```

Open `http://127.0.0.1:3000`. The report includes:

- Summary counts for healthy, warning, critical, no-signal, and API-error rows
- Search across address, account, ONT ID, serial number, and OLT
- Status filtering
- 50-row pagination
- ONT and OLT receive power, collection time, and error details
- Automatic cache reload every 60 seconds

The server binds to `0.0.0.0` by default so a VM can serve the report through
any IPv4 interface. Open it with the VM's IPv4 address and `WEB_PORT`. Set
`WEB_HOST=127.0.0.1` for local-only access. Keep the web port behind firewall
rules because the report contains account IDs and service addresses.

## Throttled collection and local cache

The collector runs one serial queue per OLT and shares a global limit of 240
request starts per minute. This keeps each OLT at one active status call while
allowing the four OLTs to be checked in parallel.

Run one full collection with:

```powershell
npm run smx:collect
```

Run continuously on a 15-minute cycle with:

```powershell
npm run smx:collector
```

The cache is written atomically to `data/light-level-cache.json`. The `data`
directory is ignored by Git because the cache contains account IDs and service
addresses.

The first full pass checked all 416 ONTs in 296 seconds. It returned 401 live
readings and 15 HTTP 500 failures from the OLT whose 15 ONTs had no operational
status. Sixteen successful status calls returned `0/0 dBm`; those values are
treated as unavailable instead of healthy.

## Subscriber and address join

SMx reports 416 subscriber records and 416 global ONT records. ONT
`subscriber-id` matches subscriber `customId`. The latest check found 415 ONTs
with a subscriber match and 414 joined rows with a usable address.

Run the count-only join check with:

```powershell
npm run smx:check-subscribers
```

The subscriber response is reduced to account ID and primary address as soon as
it is received. Names and contacts are not kept. The global ONT response is
reduced to OLT name, ONT ID, serial number, and subscriber ID.

## OLT and ONT discovery

The live SMx inventory reports four OLTs with 158, 15, 4, and 239
provisioned ONTs, for a total of 416. ONTs are listed under each OLT with:

```text
GET /rest/v1/config/device/{device-name}/ont
```

Live ONT status comes from:

```text
GET /rest/v1/performance/device/{device-name}/ont/{ont-id}/status
```

The report uses `opt-signal-level` for ONT receive power and
`ne-opt-signal-level` for OLT receive power. Run the inventory and sample status
check with:

```powershell
npm run smx:check-ont
```

The command prints OLT and ONT counts plus one anonymized pair of receive-power
readings. It does not print OLT names, ONT IDs, or subscriber details.

## SMx connection check

This iteration intentionally does one thing: verify that the tool can make an
authenticated, read-only request to SMx. It requests one managed OLT record and
prints only connection metadata, never the SMx response payload. The four
records reported by this endpoint are the four OLTs, not their attached ONTs.

The request is:

```text
GET /rest/v1/config/device?limit=1
```

### Requirements

- Node.js 22.18 or newer
- Network access to the SMx Northbound API on port `18443`
- An SMx account, preferably dedicated and read-only

Install the locked application dependencies before running the tool:

```powershell
npm install
```

### Configure the connection

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Fill in `SMX_USERNAME` and `SMX_PASSWORD` in `.env`. If the SMx server uses a
self-signed certificate, set:

```dotenv
SMX_ALLOW_SELF_SIGNED_CERT=true
```

The exception is scoped to this tool's SMx requests. TLS verification remains
enabled for every other Node.js connection. The `.env` file is ignored by Git.

If Node reports `EE certificate key too weak`, the SMx certificate uses an old
key. Set `SMX_TLS_SECURITY_LEVEL=1` as a temporary compatibility setting. This
setting is scoped to the SMx client; replacing the old server certificate is
the long-term fix.

### Run the check

```powershell
npm run smx:check
```

A successful check reports the HTTP status, response time, and record counts
without displaying OLT or subscriber details.

Run the automated configuration tests with:

```powershell
npm test
```

## Agreed MVP

The current MVP:

1. Retrieve all subscriber accounts and primary service addresses using API
   pagination.
2. Retrieve the ONTs attached to each of the four OLTs.
3. Associate each ONT with its subscriber account and service address.
4. Collect ONT and OLT receive power every 15 minutes with SMx-safe throttling.
5. Cache the latest results locally.
6. Present a searchable table containing address, account ID, ONT and OLT
   identifiers, both receive powers, overall health, last update, and errors.

Subscriber names and contact details are outside the MVP.

### Initial operational bands

| Status | Receive power |
| --- | ---: |
| No signal / offline | `0 dBm`, `<= -30 dBm`, or unavailable |
| Critical | `> -30 dBm` through `-28 dBm` |
| Warning | `> -28 dBm` through `-25 dBm` |
| Healthy | `> -25 dBm` |

These bands will be configurable. Overall address health will use the worse of
the ONT and OLT readings.

## Planned reviews

Each stage is reviewed before the next one starts:

1. SMx connection and exact live status response fields - complete
2. OLT inventory and ONT listing - complete
3. Subscriber/address pagination - complete
4. Subscriber-to-ONT association - complete
5. Throttled light-level collection and caching - complete
6. Searchable report table - complete
7. Address geocoding - complete
8. Map display - complete
9. CSV export
