# Design Specification: NINE LIVES Tactical Extension — System Signatures Ingestion

- **Date:** 2026-09-13
- **Application Title:** NINE LIVES Console // Tactical Extension (Part 2: Signatures Ingest)
- **Platform:** Google Chrome Extension (Manifest V3)
- **Engine:** High-Speed Deterministic DOM Table Extractor
- **Target Context:** Wanderer EVE Online Map — Active System Signatures Panel

---

## 1. Executive Summary & Problem Statement

In addition to topological system chains, EVE Online wormhole pilots require real-time cosmic signature intelligence from the active system they are scouting (e.g. wormholes, combat anomalies, ore sites, data/relic sites). In Wanderer, when an explorer or scout clicks a solar system on the map, a **Signatures** panel opens displaying a structured table of discovered cosmic signatures.

Ingesting this signature data into fleet consoles or spreadsheets previously required manual copying or error-prone copy-pasting.

This specification details **Part 2** of the NINE LIVES Tactical Extension:
1. Activating the second tactical action button in the HUD popup: **`Get System Signatures [SIGS]`**.
2. Scanning the active Wanderer tab for the open Signatures panel (e.g. `[6] Signatures in C4 J215758`).
3. Extracting the **System Identifier** and **Wormhole Class** from the panel header.
4. Extracting the first three primary columns: **`Id`**, **`Group`**, and **`Info`** (including inner badge designations such as `C3`, `C4`, `C5`).
5. Formatting the data with the active System ID and Wormhole Class on line 1, followed by rows with no column headers (defaulting to Tab-Separated Values `TSV`, with toggles for structured `JSON` and `Markdown Table`).
6. Automatically writing the formatted dataset to the user's system clipboard with instant latency feedback in the AURA HUD.

---

## 2. Requirements & Data Formatting

### 2.1 Extracted Fields
* **System ID:** System name from the panel title (e.g. `J215758`, `Jita`, `38G6-L`).
* **Wormhole / Security Class:** Class badge from the panel title (e.g. `C4`, `C1`–`C6`, `Highsec`, `Lowsec`, `Nullsec`).
* **Column 1 — Signature ID (`Id`):** Cosmic signature designation (e.g. `BSG-714`, `RIS-443`, `SHX-448`, `SVG-364`, `ZCD-829`, `ZCG-448`). Strips non-alphanumeric icon decorations.
* **Column 2 — Group (`Group`):** Signature type category (e.g. `Wormhole`, `Combat Site`, `Ore Site`, `Relic Site`, `Data Site`, `Gas Site`).
* **Column 3 — Info (`Info`):** Tactical intelligence and destination detail. Normalizes child elements and badge text into a single space-separated string (e.g. `A C247 C3 J172701`, `Frontier Command Post`, `Average Frontier Deposit`).

### 2.2 Output Formats (Controlled by Clipboard Format Ribbon)

#### TSV Format (Default)
Line 1 contains the system name and class in parentheses. Subsequent lines contain tab-delimited columns with **no** column headers:
```tsv
J215758 (C4)
BSG-714	Wormhole	A C247 C3 J172701
RIS-443	Wormhole	D X877 C4 J120409
SHX-448	Wormhole	E U574 C6 J120512
SVG-364	Combat Site	Frontier Command Post
ZCD-829	Ore Site	Average Frontier Deposit
ZCG-448	Wormhole	B H900 C5 J141204
```

#### JSON Format
A clean, typed JSON object for programmatic integration:
```json
{
  "system": "J215758",
  "class": "C4",
  "signatures": [
    { "id": "BSG-714", "group": "Wormhole", "info": "A C247 C3 J172701" },
    { "id": "RIS-443", "group": "Wormhole", "info": "D X877 C4 J120409" },
    { "id": "SHX-448", "group": "Wormhole", "info": "E U574 C6 J120512" },
    { "id": "SVG-364", "group": "Combat Site", "info": "Frontier Command Post" },
    { "id": "ZCD-829", "group": "Ore Site", "info": "Average Frontier Deposit" },
    { "id": "ZCG-448", "group": "Wormhole", "info": "B H900 C5 J141204" }
  ]
}
```

#### Markdown Table Format
Formatted table for Discord tactical ops channels or fleet notes:
```markdown
### J215758 (C4)
| Id | Group | Info |
| --- | --- | --- |
| BSG-714 | Wormhole | A C247 C3 J172701 |
| RIS-443 | Wormhole | D X877 C4 J120409 |
| SHX-448 | Wormhole | E U574 C6 J120512 |
| SVG-364 | Combat Site | Frontier Command Post |
| ZCD-829 | Ore Site | Average Frontier Deposit |
| ZCG-448 | Wormhole | B H900 C5 J141204 |
```

---

## 3. Architecture & File Changes

```
AstrumExtension/
├── manifest.json                  # Manifest V3 configuration (unchanged, existing permissions suffice)
├── popup/
│   ├── popup.html                 # Replaces button 2 with armed [Get System Signatures]
│   ├── popup.css                  # Tactical styling for signatures badge & status
│   └── popup.js                   # Handles btnSignatures click, triggers extraction, formats & copies
├── content/
│   ├── extractor.js               # Exports extractWandererSignatures() alongside map extractor
│   └── signatures-extractor.js    # (Optional modular extractor or unified in extractor.js)
├── lib/
│   └── formatters.js              # Dedicated formatters for Signatures (TSV, JSON, MD)
├── sandbox/
│   └── test-map.html              # Adds mock Wanderer Signatures table widget for offline verification
└── tests/
    └── signatures.test.js         # Unit and integration tests for Signatures extraction & formatting
```

---

## 4. Extraction Strategy & Robustness

Wanderer renders the Signatures panel in the DOM (often within an overlay or drawer panel that was previously excluded from map SVG parsing).

### 4.1 Header Identification
1. Searches the document and iframes for elements containing the regex:
   `/(?:\[\d+\]\s*)?Signatures\s+in\s+([A-Z0-9]+)\s+([A-Z0-9\-]+)/i`
   or structured header text matching `Signatures in`.
2. Extracts:
   * Class: e.g. `C4`
   * System: e.g. `J215758`

### 4.2 Multi-Tier Row & Cell Resolution
* **Tier 1 (HTML `<table>`):**
  * Locates `table` inside or adjacent to the header.
  * Inspects `<thead>` to identify column indices corresponding to `Id`, `Group`, and `Info` (defaults to columns 0, 1, 2).
  * Iterates `<tbody> tr`. For each row, collects:
    * `Id`: text from the first column matching `[A-Z]{3}-\d{3}` or alphanumeric ID.
    * `Group`: text from the second column.
    * `Info`: text from the third column, normalizing inner spans, badges, and text nodes into single space-separated tokens.
* **Tier 2 (Grid / Virtualized `div[role="row"]`):**
  * If no `<table>` is found, searches for elements with `role="row"` or grid row classes within the signatures panel.
  * Collects cell elements (`role="cell"`, `td`, or `div[class*="cell"]`).
* **Tier 3 (Text Line Regex Fallback):**
  * If DOM class structure is completely obscured, scans all text lines within the panel for cosmic signature tokens (`[A-Z]{3}-\d{3}`) followed by known EVE signature groups (`Wormhole`, `Combat Site`, `Ore Site`, `Relic Site`, `Data Site`, `Gas Site`), capturing the subsequent text as `Info`.

---

## 5. UI Integration & User Flow

1. User opens the NINE LIVES Tactical Extension popup while viewing Wanderer.
2. Extension detects Wanderer (`SYNCED`).
3. Both Action 1 (`Get Wanderer Systems [W-SPACE]`) and Action 2 (`Get System Signatures [SIGS]`) are active and highlighted.
4. User clicks **`Get System Signatures [SIGS]`**.
5. Content script extracts signatures table and returns `{ success, system, class, signatures }`.
6. Extension formats output according to active format toggle (`TSV` default).
7. Calls `navigator.clipboard.writeText(...)`.
8. UI flashes emerald success border:
   `[✓] COPIED // X SIGNATURES (<SYSTEM> <CLASS>)`.
9. Formatted text displays in the `CONSOLE_RESPONSE` preview box with live latency (`LATENCY: 2ms`).

### 5.1 Error Handling
* If Wanderer is open but no Signatures panel is active (e.g. user hasn't clicked a system on the map yet), the console responds with:
  ```
  [!] NO SIGNATURES PANEL OPEN
  Click a system on the Wanderer map to open its Signatures table, then try again.
  ```

---

## 6. Verification Plan

1. **Unit Tests (`tests/signatures.test.js`):**
   * Parse synthetic HTML matching the user's Wanderer screenshot table.
   * Verify extracted System = `J215758` and Class = `C4`.
   * Verify all 6 rows correctly parsed with exact IDs, groups, and badge text (`A C247 C3 J172701`).
   * Test TSV output: verify line 1 is `J215758 (C4)` and rows are tab-separated with no headers.
   * Test JSON and Markdown output formats.
2. **Sandbox Testing (`sandbox/test-map.html`):**
   * Render the authentic Wanderer Signatures widget alongside the SVG map.
   * Open the popup on the sandbox page, click `[ Get System Signatures ]`.
   * Verify clipboard contains the exact formatted TSV.
   * Verify HUD feedback flashes emerald.
