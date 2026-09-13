# NINE LIVES Tactical Extension // Consolidated User Guide & Technical Manual

> **Document Type:** RAG-Searchable Knowledge Base & User Manual  
> **Version:** 2.0.0 (Manifest V3)  
> **Target Systems:** EVE Online, Wanderer Wormhole Mapper, Chrome Extension Platform  
> **Classification:** Tactical Intelligence Automation  
> **Keywords:** Wanderer, EVE Online, wormholes, J-Space, signatures, local pilots, Gemini Nano, Prompt API, TSV, clipboard, anti-table shield, React fiber, ship tags, fleet ops

---

## Quick Navigation Index

- [1. Tactical Overview & System Architecture](#1-tactical-overview--system-architecture)
- [2. Installation, Permissions & Environment Setup](#2-installation-permissions--environment-setup)
- [3. Chrome Built-in AI (Prompt API / Gemini Nano) Configuration](#3-chrome-built-in-ai-prompt-api--gemini-nano-configuration)
- [4. Module 1: Wanderer Systems Chain Ingestion [W-SPACE]](#4-module-1-wanderer-systems-chain-ingestion-w-space)
  - [4.1 Purpose & Execution](#41-purpose--execution)
  - [4.2 Column Order & Schema](#42-column-order--schema)
  - [4.3 System Classification & Parsing Engine](#43-system-classification--parsing-engine)
- [5. Module 2: System Signatures Ingestion [SIGS]](#5-module-2-system-signatures-ingestion-sigs)
  - [5.1 Purpose & Execution](#51-purpose--execution)
  - [5.2 Column Order & Schema](#52-column-order--schema)
  - [5.3 Text Normalization & Anti-Table Isolation](#53-text-normalization--anti-table-isolation)
- [6. Module 3: Local System Pilots Roster Ingestion [LOCAL]](#6-module-3-local-system-pilots-roster-ingestion-local)
  - [6.1 Purpose & Execution](#61-purpose--execution)
  - [6.2 Column Order & Schema](#62-column-order--schema)
  - [6.3 Ship Name vs. Ship Type Resolution](#63-ship-name-vs-ship-type-resolution)
  - [6.4 Automated Auto-Enable & Hover Preview](#64-automated-auto-enable--hover-preview)
  - [6.5 React In-Memory Fallback Scanner](#65-react-in-memory-fallback-scanner)
  - [6.6 Anti-Table & Anti-Structure Shield](#66-anti-table--anti-structure-shield)
- [7. Clipboard Output Formats & Format Ribbon](#7-clipboard-output-formats--format-ribbon)
  - [7.1 Tab-Separated Values (TSV)](#71-tab-separated-values-tsv)
  - [7.2 JavaScript Object Notation (JSON)](#72-javascript-object-notation-json)
  - [7.3 Markdown Table (MD)](#73-markdown-table-md)
- [8. Tactical Settings & Domain Authorizations](#8-tactical-settings--domain-authorizations)
- [9. Offline Sandbox & Verification Testing](#9-offline-sandbox--verification-testing)
- [10. Troubleshooting & FAQ](#10-troubleshooting--faq)

---

## 1. Tactical Overview & System Architecture

The **NINE LIVES Tactical Extension** is a Manifest V3 browser extension built for EVE Online wormhole scout, logistics, and fleet commanders operating on the **Wanderer** mapping platform.

### Core Capabilities
1. **Wanderer Chain Topology [W-SPACE]:** Scrapes SVG canvas vector nodes and classifies entire wormhole chain graphs with locked column alignments.
2. **System Signatures [SIGS]:** Extracts cosmic signatures, wormholes, combat anomalies, and relic/data sites from Wanderer's active system table.
3. **Local Pilots [LOCAL]:** Scrapes pilot identities, corporation tickers, ship types, custom assigned tags, and direct CCP portrait URLs with zero stray data capture.

```
┌─────────────────────────────────────────────────────────────┐
│                      AURA Tactical HUD                      │
│             360px × 480px Sci-Fi Interface (popup/)         │
├──────────────────────────────┬──────────────────────────────┤
│  [1] Get Wanderer Systems    │   [2] Get System Signatures  │
│      [W-SPACE] (Cyan)        │       [SIGS] (Amber)         │
├──────────────────────────────┴──────────────────────────────┤
│               [3] Get Pilots in System                      │
│                   [LOCAL] (Emerald)                         │
├─────────────────────────────────────────────────────────────┤
│  Clipboard Ribbon: [ TSV (Default) ]  [ JSON ]  [ MD TABLE ]│
├─────────────────────────────────────────────────────────────┤
│  Live Console Telemetry Feed & Status Bar                   │
└─────────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
    content/extractor.js  signatures-extractor.js pilots-extractor.js
    (SVG Map Canvas)      (Signatures Table)     (Local Flex Roster)
```

---

## 2. Installation, Permissions & Environment Setup

### Installation Steps
1. Open Google Chrome.
2. Navigate to `chrome://extensions` in the address bar.
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the downloaded/extracted folder where `manifest.json` is located (e.g., `AstrumExtension/`).
6. Pin the **NINE LIVES Console** icon to your Chrome toolbar.

### Packaging & Distributing to Fleet / Corp Members
When sharing this extension with corp members or alliance scouts:

* **Recommended Method: Distribute as a `.zip` Archive**
  1. Compress the extension directory containing `manifest.json` into a `.zip` file (e.g. `NINELIVES-TacticalExtension-v2.0.zip`).
  2. Fleet members download the `.zip`, right-click -> **Extract All**.
  3. They go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the unzipped folder.
  4. *Why this is best:* Chrome allows unpacked developer extensions to run without restriction, requiring no developer fee or enterprise policies.

* **Why NOT to use "Pack Extension" (`.crx`):**
  - Clicking "Pack extension" in `chrome://extensions` generates a `.crx` file and a `.pem` private key.
  - However, modern Google Chrome **blocks off-store `.crx` installations** by default for security, throwing: *"Apps, extensions, and user scripts cannot be added from this website"* or disabling it on next launch.
  - Unless your users run a corporate Windows Group Policy, `.crx` files will not load smoothly for everyday fleet members. Distributing the `.zip` for **Load unpacked** is the standard and most reliable method.

### Manifest Permissions Justification
* `"tabs"`: Required to read the current tab URL and ensure the user is on an authorized Wanderer mapping instance.
* `"scripting"`: Executes self-contained deterministic extractors directly inside the Wanderer webpage without network requests.
* `"storage"`: Persists operator settings (domain patterns, auto-copy toggle, default format).
* `"clipboardWrite"`: Writes sanitized, aligned telemetry directly to the operating system clipboard for instant pasting into Discord, spreadsheets, or tactical databases.

---

## 3. Chrome Built-in AI (Prompt API / Gemini Nano) Configuration

The extension uses Chrome's built-in on-device AI (`LanguageModel` API) for heuristic text clustering, backed by an offline semantic classifier fallback.

### Enabling Chrome Gemini Nano Locally
1. In Chrome, navigate to `chrome://flags/#prompt-api-for-gemini-nano` and set to **Enabled**.
2. Navigate to `chrome://flags/#optimization-guide-on-device-model` and set to **Enabled BypassPerfRequirement**.
3. Relaunch Chrome.
4. Open `chrome://components` and check for **Optimization Guide On Device Model**. Click **Check for update** to ensure the local weights (approx. 1.5 GB) are downloaded.

> [!NOTE]
> If Chrome Prompt API is disabled or not present, the extension automatically routes through its built-in deterministic classifier. Zero functionality is lost.

---

## 4. Module 1: Wanderer Systems Chain Ingestion [W-SPACE]

### 4.1 Purpose & Execution
Clicking **`Get Wanderer Systems [W-SPACE]`** scans the active Wanderer SVG canvas, extracts all visible system node clusters, classifies each system, associates cosmic signatures and static wormholes, and formats the output into locked columns.

### 4.2 Column Order & Schema
* **Format:** Tab-Separated Values (TSV)
* **Header Line:** `System\tSignature\tClass\tTags\tStatics\tPilots`
* **Column Specifications:**

| Column Index | Field Name | Description | Example |
|---|---|---|---|
| Col 1 | `System` | EVE solar system designation (J-Space, K-Space, Nullsec) | `J113907`, `Jita`, `38G6-L` |
| Col 2 | `Signature` | Connecting wormhole cosmic signature ID (or `-` if home) | `LWT`, `BSG-714`, `-` |
| Col 3 | `Class` | Wormhole class or K-Space security status | `C5`, `C4`, `Highsec`, `Nullsec` |
| Col 4 | `Tags` | In-chain node tag or bookmark identifier | `B`, `D1.1`, `E1.4` |
| Col 5 | `Statics` | Static wormholes or target region name | `C6`, `D1.2, C4, C6`, `The Forge` |
| Col 6 | `Pilots` | Count of active fleet members in system | `4`, `1`, `-` |

### 4.3 System Classification & Parsing Engine
The classifier handles:
* **Home Systems:** When a system has no incoming signature, Column 2 explicitly outputs `-` (never shifts columns).
* **Multi-Statics:** Comma-separated statics (e.g. `D1.2, C4, C6`) remain strictly encapsulated within Column 5.
* **K-Space Named Systems:** Translates known trade hubs and regions (e.g. `Jita` -> `Highsec` / `The Forge`).
* **Nullsec Alphanumerics:** Parses standard alphanumeric designations (e.g. `38G6-L`, `N-K4Q0`, `6-UCYU`).

---

## 5. Module 2: System Signatures Ingestion [SIGS]

### 5.1 Purpose & Execution
Clicking **`Get System Signatures [SIGS]`** scrapes Wanderer's active signatures table, sanitizes fragmented text spans, normalizes whitespace, and copies the data to your clipboard.

### 5.2 Column Order & Schema
* **Line 1:** Active Solar System & Class: `<System> (<Class>)` (e.g., `J215758 (C4)`)
* **Subsequent Lines:** Clean, tab-separated rows with **no column headers**:

$$\text{Col 1: } \textbf{Id} \quad\big|\quad \text{Col 2: } \textbf{Group} \quad\big|\quad \text{Col 3: } \textbf{Info} \quad\big|\quad \text{Col 4: } \textbf{Description}$$

#### Example Output:
```tsv
J215758 (C4)
BSG-714	Wormhole	A C247 C3 J172701	Wormhole to C3
RIS-443	Wormhole	D X877 C4 J120409	Wormhole to C4
SHX-448	Wormhole	E U574 C6 J120512	Wormhole to C6
SVG-364	Combat Site	Frontier Command Post	Combat Site
ZCD-829	Ore Site	Average Frontier Deposit	Ore Site
ZCG-448	Wormhole	B H900 C5 J141204	Wormhole to C5
```

### 5.3 Text Normalization & Anti-Table Isolation
* **Unspaced Span Reconciliation:** In modern web apps, Wanderer breaks connection info across multiple child `<span>` tags (e.g. `<span>A</span><span>C247</span><span>C3</span>`). The extractor traverses child nodes and guarantees a single space between spans, preventing merged strings like `AC247C3`.
* **Lead System Resolution:** Priority resolution extracts the active system from the signatures header (`Signatures in <Class> <System>`), falling back to the selected SVG node or tab title.

---

## 6. Module 3: Local System Pilots Roster Ingestion [LOCAL]

### 6.1 Purpose & Execution
Clicking **`Get Pilots in System [LOCAL]`** ingests all characters active in the local wormhole system directly from Wanderer's `Local [n]` panel.

### 6.2 Column Order & Schema
* **Line 1:** Active Solar System & Class: `<System> (<Class>)` (e.g., `J215758 (C4)`)
* **Subsequent Lines:** Clean, tab-separated rows with **no column headers**:

$$\textbf{Portrait URL} \quad\big|\quad \textbf{Pilot Name} \quad\big|\quad \textbf{Corp Ticker} \quad\big|\quad \textbf{Ship Type} \quad\big|\quad \textbf{Ship Name}$$

#### Example Output:
```tsv
J215758 (C4)
https://images.evetech.net/characters/92029163/portrait	Abon Riff	AP.MC	Stratios	☜☠☞ Palliser
https://images.evetech.net/characters/93789049/portrait	Chrysabelle Ellecon	AP.MC	Loki	Loki
https://images.evetech.net/characters/2123051982/portrait	Michiko Yukiko	AP.MC	Crane	Mission runer
https://images.evetech.net/characters/92996645/portrait	Salva Coline	AP.MC	Astero	☜☠☞ Tapir
https://images.evetech.net/characters/1906220295/portrait	Tyrom Hir	AP.MC	Stratios	☜☠☞ Vindictive
https://images.evetech.net/characters/95727715/portrait	Victor Rizzo	AP.MC	Capsule	Capsule - Victor Rizzo
```

### 6.3 Ship Name vs. Ship Type Resolution
In Wanderer, a pilot entry has two ship components:
1. **Ship Hull Classification (Col 4):** The actual EVE ship hull (`Stratios`, `Astero`, `Loki`, `Crane`, `Confessor`). Resolved directly from the official CCP ship type icon (`https://images.evetech.net/types/{typeId}/icon`) using a built-in offline dictionary of 569 flyable ship IDs.
2. **Assigned Ship Name / Tag (Col 5):** The custom name assigned by the pilot (e.g. `☜☠☞ Palliser`, `Mission runer`, `Capsule - Victor Rizzo`). If the pilot has not renamed their ship, it defaults to the hull type (`Loki`).

### 6.4 Automated Auto-Enable & Hover Preview
Wanderer includes a **"Ship name"** toggle checkbox in the Local header:
* **When Checked (`[✓]`):** Wanderer renders custom player tags.
* **When Unchecked (`[ ]`):** Wanderer replaces tags with hull types, resulting in duplicated hull names (`Stratios \t Stratios`).

#### Built-In Protections:
1. **Automated State Check & Click:** When you click the button, the extractor checks if Wanderer's toggle is unchecked. If unchecked, it **automatically clicks the toggle**, pauses 80ms for React to update the DOM, and extracts the roster with custom tags.
2. **`onMouseOver` Live HUD Preview:** Hovering over the button triggers a live preview in the HUD console with tactical tips:
   > ◈ **TACTICAL SCANNER: LOCAL PILOTS [LOCAL]**  
   > *Scrapes pilot identities, corp tickers, ship types & custom fleet tags.*  
   > 💡 **Pro-Tip:** Ensure *"Ship name" [✓]* is checked in Wanderer for custom tags (e.g. ☜☠☞ Palliser). The extension will also attempt to auto-check it if needed.

### 6.5 React In-Memory Fallback Scanner
If Wanderer's DOM does not expose the custom tag, the extractor directly inspects React's component memory (`__reactProps$` / `__reactFiber$`) on the row element to read `pilot.ship.name` directly from in-memory props.

### 6.6 Anti-Table & Anti-Structure Shield
On live Wanderer pages with multiple panels open (Signatures, Routes, Structures, Local):
* **Strict Anti-Table Rule:** Rejects any element inside or containing `<table>`, `<tr>`, `<td>`, or `<th>`. Wanderer's Local roster uses CSS flex containers and never uses tables.
* **Asset Filtering:** Rejects structure icons (`/types/35833/icon` for Fortizar, Astrahus, etc.) and jump gate/wormhole bracket icons (`/brackets/`).
* **Portrait Anchor:** Pilot rows are strictly anchored to CCP character portraits (`https://images.evetech.net/characters/<id>/portrait`).

---

## 7. Clipboard Output Formats & Format Ribbon

The extension features a persistent format ribbon below the action buttons:
```
CLIPBOARD FORMAT: [ TSV (Default) ]  [ JSON ]  [ MD TABLE ]
```

### 7.1 Tab-Separated Values (TSV)
* Default format for direct pasting into Google Sheets, Microsoft Excel, and Discord code blocks.
* Line 1 displays the solar system and class header; subsequent lines contain raw tab-delimited values with no extra headers.

### 7.2 JavaScript Object Notation (JSON)
Produces strict, structured JSON for programmatic APIs or automated webhook pipelines:
```json
{
  "system": "J215758",
  "class": "C4",
  "count": 2,
  "pilots": [
    {
      "pilot": "Abon Riff",
      "corp": "AP.MC",
      "shipType": "Stratios",
      "shipName": "☜☠☞ Palliser",
      "portraitUrl": "https://images.evetech.net/characters/92029163/portrait"
    }
  ]
}
```

### 7.3 Markdown Table (MD)
Produces formatted Markdown tables for GitHub, Jira, Notion, and Discord:
```markdown
### J215758 (C4)
| Portrait | Pilot | Corp | Ship Type | Ship Name |
|---|---|---|---|---|
| ![](https://images.evetech.net/characters/92029163/portrait) | Abon Riff | AP.MC | Stratios | ☜☠☞ Palliser |
```

---

## 8. Tactical Settings & Domain Authorizations

Click the **Gear Icon** (`⚙`) in the top right of the HUD to open Tactical Settings (`settings/settings.html`).

### Authorized URL Patterns
Add custom domain patterns matching your corporation or alliance Wanderer instance (wildcards `*` supported):
```
http://localhost:*
https://wanderer.mycorp.com/*
https://maps.eve-wanderer.net/*
```

### Preferences
* **Auto-Copy to Clipboard:** When checked (default), successful extraction immediately writes formatted data to your clipboard.
* **Default Output Format:** Set the default format (TSV, JSON, or Markdown Table) across browser restarts.

---

## 9. Offline Sandbox & Verification Testing

For testing on laptops without active EVE Online accounts or corp VPN access:

1. Open `sandbox/test-map.html` directly in Chrome.
2. Click the extension icon.
3. Use the sandbox controls to toggle between populated rosters (`Local [3]`) and empty systems (`Local [0]`).
4. Run all automated unit and integration tests from terminal:
   ```bash
   node tests/formatters.test.js
   node tests/signatures-extractor.test.js
   node tests/signatures-simulation.test.js
   node tests/pilots-formatters.test.js
   node tests/pilots-extractor.test.js
   node tests/pilots-simulation.test.js
   node tests/end-to-end.test.js
   ```

---

## 10. Troubleshooting & FAQ

### Q: Why does the HUD say `[!] NO LOCAL PILOTS DETECTED`?
* **A:** Ensure the `Local [n]` panel is open in Wanderer. If closed, click Wanderer's local roster icon in the sidebar to open the panel, then re-click the button.

### Q: Why does the HUD report `[!] LOCAL CLEAR // NO PILOTS IN SYSTEM`?
* **A:** Wanderer explicitly reports `Local [0]` (nobody online in system). The anti-table shield prevents stray structures or signatures from being captured.

### Q: Why are my ship names identical to ship types (`Stratios \t Stratios`)?
* **A:** This occurs when Wanderer's "Ship name" toggle is unchecked and auto-check could not reach the toggle. Keep **"Ship name" [✓]** checked in Wanderer's Local header; Wanderer remembers this setting in browser local storage.

### Q: Why did the HUD report `[!] INGESTION ALERT // CURRENT TAB NOT AUTHORIZED`?
* **A:** The active tab URL does not match your authorized Wanderer patterns. Click the Gear icon (`⚙`) in the popup and add your domain (e.g. `https://your-domain.com/*`).

---
*Authored by the Google DeepMind Antigravity Engineering Team for the NINE LIVES Tactical Operations Corps.*
