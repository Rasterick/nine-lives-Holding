# Design Specification: NINE LIVES Tactical Extension — Local System Pilots Ingestion

- **Date:** 2026-09-13
- **Application Title:** NINE LIVES Console // Tactical Extension (Part 3: Local Pilots Ingest)
- **Platform:** Google Chrome Extension (Manifest V3)
- **Engine:** High-Speed Deterministic DOM Local Scraper (Approach 1)
- **Target Context:** Wanderer EVE Online Map — Active System `Local [n]` Panel

---

## 1. Executive Summary & Problem Statement

In wormhole space (Anoikis / J-space), intelligence on pilots in system (Wanderer's `Local [n]` panel) is critical for tactical decision making, fleet safety, and combat readiness. While in wormhole space local chat is delayed, mapping tools like Wanderer track pilots who report in system or are logged into Wanderer tracking.

In Wanderer, when an operator views a system with registered pilots, a **Local [n]** panel displays:
- Count of pilots in system (e.g., `Local [2]`).
- Character portrait thumbnail image.
- Pilot character name with corporation ticker in brackets (e.g., `Chrysabelle Ellecon [AP.MC]`).
- Ship name / custom player tag (e.g., `Capsule - Chrysa...`, `Into the Breach`).
- Ship icon with ship type metadata (e.g., `Capsule`, `Nemesis`).

Prior to this feature, copying this intelligence into fleet notes, tactical spreadsheets, or Discord channels required tedious manual typing.

This specification details **Part 3** of the NINE LIVES Tactical Extension:
1. Activating the third tactical action button in the HUD popup: **`Get Pilots in System [LOCAL]`** (armed with `.dot-cyan` status indicator).
2. Scraping the active Wanderer tab's `Local [n]` panel via a fast, zero-network, deterministic DOM extractor (`extractWandererPilots`).
3. Resolving the active System Identifier and Wormhole Class (from the open Signatures panel, active SVG canvas node, or page context).
4. Extracting the structured pilot fields: `Pilot Name`, `Corp Ticker`, `Ship Name`, `Ship Type`, and `Portrait URL`.
5. Formatting the data consistently with Part 2:
   - Line 1: `<System> (<Class>)` (e.g. `J215758 (C4)`).
   - Rows tab-delimited with **no** column headers (`Pilot Name\tCorp\tShip Name\tShip Type\tPortrait URL`).
   - Supporting toggles for `TSV`, `JSON`, and `Markdown Table`.
6. Writing directly to the user's system clipboard with latency feedback and status logging in the AURA Tactical HUD.

---

## 2. Requirements & Data Formatting

### 2.1 Extracted Fields
* **System ID & Class:** Active solar system and security/wormhole class (e.g., `J215758 (C4)`).
* **Pilot Name:** Full character name (e.g., `Chrysabelle Ellecon`, `Ultimate Pikie`).
* **Corp Ticker:** Extracted corporation abbreviation without brackets (e.g., `AP.MC`).
* **Ship Name:** Custom player ship name or tag (e.g., `Capsule - Chrysa...`, `Into the Breach`).
* **Ship Type:** Ship hull classification resolved from icon `alt`, `title`, or data attributes (e.g., `Capsule`, `Nemesis`).
* **Portrait URL:** Direct image URL of the character portrait (e.g., `https://images.evetech.net/characters/...` or Wanderer proxy path).

### 2.2 Output Formats (Controlled by Clipboard Format Ribbon)

#### TSV Format (Default)
Line 1 contains `<System> (<Class>)`. Subsequent lines contain tab-delimited pilot rows with **no** column headers:
```tsv
J215758 (C4)
Chrysabelle Ellecon	AP.MC	Capsule - Chrysa...	Capsule	https://images.evetech.net/characters/12345/portrait?size=64
Ultimate Pikie	AP.MC	Into the Breach	Nemesis	https://images.evetech.net/characters/67890/portrait?size=64
```

#### JSON Format
Typed JSON object for console/data ingestion:
```json
{
  "system": "J215758",
  "class": "C4",
  "count": 2,
  "pilots": [
    {
      "pilot": "Chrysabelle Ellecon",
      "corp": "AP.MC",
      "shipName": "Capsule - Chrysa...",
      "shipType": "Capsule",
      "portraitUrl": "https://images.evetech.net/characters/12345/portrait?size=64"
    },
    {
      "pilot": "Ultimate Pikie",
      "corp": "AP.MC",
      "shipName": "Into the Breach",
      "shipType": "Nemesis",
      "portraitUrl": "https://images.evetech.net/characters/67890/portrait?size=64"
    }
  ]
}
```

#### Markdown Table Format
Clean formatted table for Discord or flight logs:
```markdown
### J215758 (C4) — Local [2]
| Pilot | Corp | Ship Name | Ship Type | Portrait |
| --- | --- | --- | --- | --- |
| Chrysabelle Ellecon | AP.MC | Capsule - Chrysa... | Capsule | ![](https://images.evetech.net/characters/12345/portrait?size=64) |
| Ultimate Pikie | AP.MC | Into the Breach | Nemesis | ![](https://images.evetech.net/characters/67890/portrait?size=64) |
```

---

## 3. DOM Scraping Strategy

### 3.1 Panel & Header Resolution
1. **Locating the Panel:**
   - Scan for headings or containers containing `Local\s*\[\d+\]` (case-insensitive).
   - Wanderer renders standard cards or sidebar blocks where the header title is `Local [n]`.
2. **Resolving System ID & Class:**
   - Wanderer's `Local [n]` panel itself does not repeat the system name.
   - Priority 1: Check if the Signatures panel is present in the DOM (`Signatures in <Class> <System>`).
   - Priority 2: Check active/selected node in Wanderer's SVG map (`.system-node.active`, `[aria-selected="true"]`, or node with matching selection ring).
   - Priority 3: Fall back to active tab title or default `UNKNOWN (W-SPACE)`.

### 3.2 Row Parsing
Each pilot item in the `Local` panel is rendered as a list item or card containing:
1. **Avatar Image:**
   - Tag `<img>` with class/attribute indicating character portrait, or first image in row. Extract `src`.
2. **Character & Corp:**
   - Look for text matching `^(.*?)(?:\s*\[([A-Z0-9.\-_]{2,8})\])?$`.
   - Name is captured as Group 1 (trimmed).
   - Corp ticker is captured as Group 2 (trimmed).
3. **Ship Info:**
   - Ship Name: Text node next to or below character name (e.g. `Capsule - Chrysa...`).
   - Ship Type: Extracted from ship icon `<img>` or SVG icon `title`, `alt`, or data attribute (`data-ship-type`, `title="Nemesis"`).

### 3.3 Execution Isolation Rule
Like `extractWandererSignatures`, `extractWandererPilots` MUST be completely self-contained in a single function so that it can be injected into the host tab via `chrome.scripting.executeScript({ func: extractWandererPilots })` without external dependency or scope references.

---

## 4. UI & HUD Integration

1. **Button 3 (`btnPilots`):**
   - Active state in `popup/popup.html`:
     ```html
     <button class="tactical-btn" id="btnPilots">
       <span class="btn-icon">
         <span class="dot-indicator dot-cyan"></span>
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
           <circle cx="9" cy="7" r="4"></circle>
           <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
           <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
         </svg>
       </span>
       <span class="btn-text">
         <span class="btn-primary-text">Get Pilots in System</span>
         <span class="btn-secondary-text">SCRAPE LOCAL ROSTER &bull; [LOCAL]</span>
       </span>
     </button>
     ```
2. **State Management & Re-Copy:**
   - `lastIngestType`: `'pilots'`.
   - `lastPilotsData`: Holds parsed pilots object.
   - Format ribbon toggles immediately re-format and copy `lastPilotsData`.
   - Tactical log displays `[PILOTS] INGESTED: 2 PILOTS IN J215758 (C4)`.

---

## 5. Offline Sandbox & Test Automation

1. **`sandbox/test-map.html`:**
   - Add a mock `Local [2]` panel alongside the `Signatures in C4 J215758` panel and SVG map.
   - Include `Chrysabelle Ellecon [AP.MC]` and `Ultimate Pikie [AP.MC]`.
2. **Automated Unit & Simulation Tests:**
   - `tests/pilots-formatters.test.js`: Validates `formatPilotsData` for TSV, JSON, MD.
   - `tests/pilots-extractor.test.js`: Validates DOM extraction against mock Wanderer DOM.
   - `tests/pilots-simulation.test.js`: End-to-end simulation of popup button click, extraction, formatting, and clipboard write.
