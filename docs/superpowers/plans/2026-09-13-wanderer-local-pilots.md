# Wanderer Local System Pilots Ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Part 3 of the NINE LIVES Tactical Extension to extract pilot roster data (`Pilot Name`, `Corp Ticker`, `Ship Name`, `Ship Type`, `Portrait URL`) from Wanderer's `Local [n]` panel and automatically copy it to the clipboard formatted with `<System> (<Class>)` on line 1 followed by tab-separated rows with no column headers (supporting JSON and Markdown toggles).

**Architecture:** A fast, deterministic DOM scraper (`extractWandererPilots`) runs in the active Wanderer tab to locate the `Local [n]` panel, resolve the active system ID and class from context, and parse character/ship/portrait metadata without network calls. The popup orchestrator formats the output according to the active clipboard ribbon format, writes it to the user's clipboard, and streams real-time tactical telemetry to the AURA HUD.

**Tech Stack:** JavaScript (ES Modules), Chrome Extension Manifest V3 (`scripting`, `tabs`, `storage`, `clipboardWrite`), Node.js built-in test runner.

**Spec:** [2026-09-13-wanderer-local-pilots-design.md](file:///c:/Users/mitch/OneDrive/Documents/AstrumExtension/docs/superpowers/specs/2026-09-13-wanderer-local-pilots-design.md)

## Global Constraints
- Target fields: `Pilot Name`, `Corp Ticker`, `Ship Name`, `Ship Type`, `Portrait URL`.
- TSV format: Line 1 must be `<System> (<Class>)` (e.g. `J215758 (C4)`), followed by tab-separated rows with **no** column headers.
- The extraction function `extractWandererPilots` MUST be 100% self-contained so it can be injected via `chrome.scripting.executeScript({ func: extractWandererPilots })` without throwing `ReferenceError`.
- System ID and Class must be resolved from:
  1. Active Signatures panel if present (`Signatures in <Class> <System>`).
  2. Selected SVG map node (`.active`, `[aria-selected="true"]`).
  3. Page title / window context.
  4. Fallback: `UNKNOWN (W-SPACE)`.
- Support clipboard format ribbon (TSV default, JSON, Markdown Table).
- Zero external network dependencies (operates offline and in local sandbox).

---

### Task 1: Pilots Tactical Formatter (`lib/formatters.js`)

**Files:**
- Modify: `lib/formatters.js`
- Test: `tests/pilots-formatters.test.js`

**Interfaces:**
- Consumes: Raw pilots extraction object:
  ```javascript
  {
    system: 'J215758',
    class: 'C4',
    count: 2,
    pilots: [
      {
        pilot: 'Chrysabelle Ellecon',
        corp: 'AP.MC',
        shipName: 'Capsule - Chrysa...',
        shipType: 'Capsule',
        portraitUrl: 'https://images.evetech.net/characters/12345/portrait?size=64'
      },
      {
        pilot: 'Ultimate Pikie',
        corp: 'AP.MC',
        shipName: 'Into the Breach',
        shipType: 'Nemesis',
        portraitUrl: 'https://images.evetech.net/characters/67890/portrait?size=64'
      }
    ]
  }
  ```
- Produces: `formatPilotsData(data, format = 'tsv')` returning formatted string.

- [x] **Step 1: Write the failing test**

```javascript
// tests/pilots-formatters.test.js
import { formatPilotsData } from '../lib/formatters.js';

const mockPilotsData = {
  system: 'J215758',
  class: 'C4',
  count: 2,
  pilots: [
    {
      pilot: 'Chrysabelle Ellecon',
      corp: 'AP.MC',
      shipName: 'Capsule - Chrysa...',
      shipType: 'Capsule',
      portraitUrl: 'https://images.evetech.net/characters/12345/portrait?size=64'
    },
    {
      pilot: 'Ultimate Pikie',
      corp: 'AP.MC',
      shipName: 'Into the Breach',
      shipType: 'Nemesis',
      portraitUrl: 'https://images.evetech.net/characters/67890/portrait?size=64'
    }
  ]
};

console.log('--- Testing formatPilotsData ---');

// 1. TSV Test (Default)
const tsv = formatPilotsData(mockPilotsData, 'tsv');
const tsvLines = tsv.trim().split('\n');

if (tsvLines[0] !== 'J215758 (C4)') {
  throw new Error(`Expected first line to be "J215758 (C4)", got "${tsvLines[0]}"`);
}
if (tsvLines[1] !== 'Chrysabelle Ellecon\tAP.MC\tCapsule - Chrysa...\tCapsule\thttps://images.evetech.net/characters/12345/portrait?size=64') {
  throw new Error(`Expected row 1 tab-delimited, got "${tsvLines[1]}"`);
}
if (tsvLines[2] !== 'Ultimate Pikie\tAP.MC\tInto the Breach\tNemesis\thttps://images.evetech.net/characters/67890/portrait?size=64') {
  throw new Error(`Expected row 2 tab-delimited, got "${tsvLines[2]}"`);
}
if (tsvLines.length !== 3) {
  throw new Error(`Expected 3 lines total (header + 2 rows), got ${tsvLines.length}`);
}

// 2. JSON Test
const jsonStr = formatPilotsData(mockPilotsData, 'json');
const parsed = JSON.parse(jsonStr);
if (parsed.system !== 'J215758' || parsed.pilots.length !== 2 || parsed.pilots[0].pilot !== 'Chrysabelle Ellecon') {
  throw new Error(`JSON output invalid: ${jsonStr}`);
}

// 3. Markdown Test
const md = formatPilotsData(mockPilotsData, 'markdown');
if (!md.includes('### J215758 (C4)') || !md.includes('| Chrysabelle Ellecon | AP.MC | Capsule - Chrysa... | Capsule |')) {
  throw new Error(`Markdown output invalid: ${md}`);
}

// 4. Empty/Edge case test
const emptyTsv = formatPilotsData(null, 'tsv');
if (emptyTsv !== '') {
  throw new Error('Expected empty string on null input');
}

console.log('✅ Pilots Formatter tests passed!');
```

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/pilots-formatters.test.js`
Expected: FAIL with `TypeError: (0 , _formatters.formatPilotsData) is not a function`

- [x] **Step 3: Implement `formatPilotsData` in `lib/formatters.js`**

Add to `lib/formatters.js`:
```javascript
/**
 * Formats local system pilots data into TSV, JSON, or Markdown.
 *
 * TSV Schema:
 * Line 1: <System> (<Class>)
 * Rows: <Pilot>\t<Corp>\t<ShipName>\t<ShipType>\t<PortraitUrl>  (no column headers)
 */
export function formatPilotsData(data, format = 'tsv') {
  if (!data || !data.pilots || !Array.isArray(data.pilots)) {
    return '';
  }

  const sys = data.system || 'Unknown';
  const cls = data.class ? `(${data.class})` : '';
  const headerLine = cls ? `${sys} ${cls}` : sys;

  if (format === 'json') {
    return JSON.stringify({
      system: data.system || 'Unknown',
      class: data.class || 'Unknown',
      count: data.pilots.length,
      pilots: data.pilots
    }, null, 2);
  }

  if (format === 'markdown') {
    const lines = [
      `### ${headerLine} — Local [${data.pilots.length}]`,
      '| Pilot | Corp | Ship Name | Ship Type | Portrait |',
      '| --- | --- | --- | --- | --- |'
    ];
    for (const p of data.pilots) {
      const portraitMd = p.portraitUrl ? `![](${p.portraitUrl})` : '';
      lines.push(`| ${p.pilot || ''} | ${p.corp || ''} | ${p.shipName || ''} | ${p.shipType || ''} | ${portraitMd} |`);
    }
    return lines.join('\n');
  }

  // Default: TSV (Line 1 = System (Class), then tab-separated rows without header)
  const rows = [headerLine];
  for (const p of data.pilots) {
    rows.push([
      p.pilot || '',
      p.corp || '',
      p.shipName || '',
      p.shipType || '',
      p.portraitUrl || ''
    ].join('\t'));
  }
  return rows.join('\n');
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node tests/pilots-formatters.test.js`
Expected: PASS with "✅ Pilots Formatter tests passed!"

- [x] **Step 5: Run existing formatters tests to ensure no regressions**

Run: `node tests/formatters.test.js`
Expected: PASS

- [x] **Step 6: Commit changes**

```bash
git add lib/formatters.js tests/pilots-formatters.test.js
git commit -m "feat(formatters): add formatPilotsData for TSV, JSON, and Markdown"
```

---

### Task 2: Self-Contained Local Pilots Extractor (`content/pilots-extractor.js`)

**Files:**
- Create: `content/pilots-extractor.js`
- Test: `tests/pilots-extractor.test.js`

**Interfaces:**
- Consumes: `doc` (Document object or mocked DOM)
- Produces: `extractWandererPilots(doc = document)` returning:
  ```javascript
  {
    success: true,
    system: 'J215758',
    class: 'C4',
    count: 2,
    pilots: [ ... ]
  }
  // OR { success: false, error: 'No Local panel detected on active page' }
  ```

- [x] **Step 1: Write the failing unit test**

```javascript
// tests/pilots-extractor.test.js
import { extractWandererPilots } from '../content/pilots-extractor.js';
import { JSDOM } from 'jsdom';

console.log('--- Testing extractWandererPilots ---');

// Mock HTML matching Wanderer DOM with Signatures panel & Local panel
const mockHtml = `
<!DOCTYPE html>
<html>
<head><title>Wanderer - C4 J215758</title></head>
<body>
  <div class="panel signatures-panel">
    <div class="header">
      <span>[6]</span>
      <span>Signatures in</span>
      <span class="badge">C4</span>
      <span>J215758</span>
    </div>
  </div>

  <div class="panel local-panel">
    <div class="panel-header">
      <span class="title">Local [2]</span>
    </div>
    <div class="panel-body">
      <div class="pilot-row">
        <div class="pilot-portrait">
          <img src="https://images.evetech.net/characters/12345/portrait?size=64" alt="Chrysabelle Ellecon" />
        </div>
        <div class="pilot-info">
          <div class="pilot-name">Chrysabelle Ellecon [AP.MC]</div>
          <div class="pilot-ship">
            <span class="ship-name">Capsule - Chrysa...</span>
            <img class="ship-icon" src="/icons/capsule.png" title="Capsule" alt="Capsule" />
          </div>
        </div>
      </div>

      <div class="pilot-row">
        <div class="pilot-portrait">
          <img src="https://images.evetech.net/characters/67890/portrait?size=64" alt="Ultimate Pikie" />
        </div>
        <div class="pilot-info">
          <div class="pilot-name">Ultimate Pikie [AP.MC]</div>
          <div class="pilot-ship">
            <span class="ship-name">Into the Breach</span>
            <img class="ship-icon" src="/icons/nemesis.png" title="Nemesis" alt="Nemesis" />
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

const dom = new JSDOM(mockHtml);
const result = extractWandererPilots(dom.window.document);

if (!result.success) {
  throw new Error(`Extraction failed: ${result.error}`);
}

if (result.system !== 'J215758') {
  throw new Error(`Expected system "J215758", got "${result.system}"`);
}
if (result.class !== 'C4') {
  throw new Error(`Expected class "C4", got "${result.class}"`);
}
if (result.count !== 2 || result.pilots.length !== 2) {
  throw new Error(`Expected 2 pilots, got ${result.pilots.length}`);
}

const p1 = result.pilots[0];
if (p1.pilot !== 'Chrysabelle Ellecon') {
  throw new Error(`Expected pilot "Chrysabelle Ellecon", got "${p1.pilot}"`);
}
if (p1.corp !== 'AP.MC') {
  throw new Error(`Expected corp "AP.MC", got "${p1.corp}"`);
}
if (p1.shipName !== 'Capsule - Chrysa...') {
  throw new Error(`Expected shipName "Capsule - Chrysa...", got "${p1.shipName}"`);
}
if (p1.shipType !== 'Capsule') {
  throw new Error(`Expected shipType "Capsule", got "${p1.shipType}"`);
}
if (!p1.portraitUrl.includes('12345')) {
  throw new Error(`Expected portraitUrl containing "12345", got "${p1.portraitUrl}"`);
}

const p2 = result.pilots[1];
if (p2.pilot !== 'Ultimate Pikie' || p2.corp !== 'AP.MC' || p2.shipName !== 'Into the Breach' || p2.shipType !== 'Nemesis') {
  throw new Error(`Pilot 2 parsing mismatch: ${JSON.stringify(p2)}`);
}

// Edge case: No Local panel
const emptyDom = new JSDOM('<div>Empty Page</div>');
const emptyResult = extractWandererPilots(emptyDom.window.document);
if (emptyResult.success) {
  throw new Error('Expected failure on page without Local panel');
}

console.log('✅ Local Pilots Extractor tests passed!');
```

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/pilots-extractor.test.js`
Expected: FAIL with "Cannot find module '../content/pilots-extractor.js'"

- [x] **Step 3: Implement `content/pilots-extractor.js`**

Implement `content/pilots-extractor.js` ensuring 100% self-containment:
- Recursive node text extractor.
- System & Class resolver (checks Signatures panel, active SVG canvas nodes, page title, fallback).
- Panel detector: Scans for elements matching `/Local\s*\[\s*(\d+)\s*\]/i`.
- Row scanner: Iterates through child elements or list items in the Local panel container.
- Field extractors:
  - Name & Corp: regex `^(.*?)(?:\s*\[([A-Za-z0-9.\-_]{2,8})\])?$`.
  - Ship Name: clean text node after pilot name.
  - Ship Type: `title`, `alt`, or `data-ship-type` of ship icon/image.
  - Portrait URL: `src` attribute of first portrait `<img>`.

- [x] **Step 4: Run test to verify it passes**

Run: `node tests/pilots-extractor.test.js`
Expected: PASS with "✅ Local Pilots Extractor tests passed!"

- [x] **Step 5: Commit changes**

```bash
git add content/pilots-extractor.js tests/pilots-extractor.test.js
git commit -m "feat(extractor): add self-contained extractWandererPilots DOM extractor"
```

---

### Task 3: Popup HUD Integration (`popup/popup.html`, `popup/popup.js`, `popup/popup.css`)

**Files:**
- Modify: `popup/popup.html`
- Modify: `popup/popup.js`
- Modify: `popup/popup.css` (if needed for `.dot-cyan`)
- Test: `tests/pilots-simulation.test.js`

**Interfaces:**
- Event: Click on `#btnPilots`.
- Script Injection: Injects `extractWandererPilots` into active tab.
- Clipboard: Formats via `formatPilotsData(data, currentFormat)` and writes to clipboard.
- Telemetry: Displays count, system, class, and latency in status log and copy notification.

- [x] **Step 1: Arm Button 3 in `popup/popup.html`**

Update `btnPilots`:
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

- [x] **Step 2: Ensure `.dot-cyan` styling in `popup/popup.css`**

Ensure `.dot-cyan` has glowing cyan pulse:
```css
.dot-cyan {
  background-color: var(--aura-cyan, #00e5ff);
  box-shadow: 0 0 8px rgba(0, 229, 255, 0.7);
}
```

- [x] **Step 3: Wire `btnPilots` and state in `popup/popup.js`**

- Import `extractWandererPilots` from `../content/pilots-extractor.js`.
- Import `formatPilotsData` from `../lib/formatters.js`.
- Add `lastPilotsData` state variable.
- In `reCopyCurrentData(format)`:
  - Check `lastIngestType === 'pilots'` and format `lastPilotsData` using `formatPilotsData`.
- Wire up `btnPilots.addEventListener('click', handleIngestWandererPilots)`.
- Implement `handleIngestWandererPilots()`:
  - Set HUD to busy (`extracting...`).
  - Execute `extractWandererPilots` on active tab via `chrome.scripting.executeScript`.
  - On success:
    - Save `lastIngestType = 'pilots'` and `lastPilotsData = result`.
    - Format output using active ribbon format.
    - Write to clipboard.
    - Log telemetry: `[PILOTS] INGESTED: ${result.count} PILOTS IN ${result.system} (${result.class}) IN ${latency}ms`.
    - Pulse green on `btnPilots` and update copy banner.
  - On error:
    - Log error and display tactical alert.

- [x] **Step 4: Commit popup integration**

```bash
git add popup/popup.html popup/popup.css popup/popup.js
git commit -m "feat(popup): activate Get Pilots in System [LOCAL] HUD action"
```

---

### Task 4: Sandbox Roster & End-to-End Simulation Testing

**Files:**
- Modify: `sandbox/test-map.html`
- Create: `tests/pilots-simulation.test.js`

- [x] **Step 1: Add Wanderer `Local [2]` panel widget into `sandbox/test-map.html`**

Add HTML widget to `sandbox/test-map.html`:
```html
<div class="wanderer-panel local-panel" id="mockLocalPanel" style="margin-top: 15px; border: 1px solid #2a3b4c; background: #0c141d; padding: 10px; border-radius: 4px;">
  <div class="panel-header" style="font-family: monospace; color: #5bc0de; font-weight: bold; margin-bottom: 8px; font-size: 13px;">
    Local [2]
  </div>
  <div class="pilot-list">
    <div class="pilot-entry" style="display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #1a2634;">
      <img src="https://images.evetech.net/characters/95000001/portrait?size=64" alt="Chrysabelle Ellecon" style="width: 32px; height: 32px; border-radius: 2px; border: 1px solid #334455;" />
      <div style="flex: 1;">
        <div style="color: #e0e6ed; font-size: 12px; font-weight: bold;">Chrysabelle Ellecon <span style="color: #8899aa;">[AP.MC]</span></div>
        <div style="color: #8899aa; font-size: 11px; display: flex; align-items: center; gap: 6px;">
          <span>Capsule - Chrysa...</span>
          <img src="/icons/capsule.png" title="Capsule" alt="Capsule" style="width: 14px; height: 14px;" />
        </div>
      </div>
    </div>
    <div class="pilot-entry" style="display: flex; align-items: center; gap: 10px; padding: 6px 0;">
      <img src="https://images.evetech.net/characters/95000002/portrait?size=64" alt="Ultimate Pikie" style="width: 32px; height: 32px; border-radius: 2px; border: 1px solid #334455;" />
      <div style="flex: 1;">
        <div style="color: #e0e6ed; font-size: 12px; font-weight: bold;">Ultimate Pikie <span style="color: #8899aa;">[AP.MC]</span></div>
        <div style="color: #8899aa; font-size: 11px; display: flex; align-items: center; gap: 6px;">
          <span>Into the Breach</span>
          <img src="/icons/nemesis.png" title="Nemesis" alt="Nemesis" style="width: 14px; height: 14px;" />
        </div>
      </div>
    </div>
  </div>
</div>
```

- [x] **Step 2: Create end-to-end simulation test `tests/pilots-simulation.test.js`**

```javascript
// tests/pilots-simulation.test.js
import { extractWandererPilots } from '../content/pilots-extractor.js';
import { formatPilotsData } from '../lib/formatters.js';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

console.log('--- Testing End-to-End Pilots Ingest with sandbox/test-map.html ---');

const htmlContent = fs.readFileSync(path.resolve('./sandbox/test-map.html'), 'utf-8');
const dom = new JSDOM(htmlContent);

// 1. Extract
const result = extractWandererPilots(dom.window.document);
if (!result.success) {
  throw new Error(`Extraction failed on sandbox: ${result.error}`);
}

console.log(`[TEST] Extracted System: ${result.system} (${result.class}), Pilot count: ${result.count}`);

if (result.system !== 'J215758' || result.class !== 'C4') {
  throw new Error(`Expected J215758 (C4), got ${result.system} (${result.class})`);
}

if (result.pilots.length !== 2) {
  throw new Error(`Expected 2 pilots, got ${result.pilots.length}`);
}

// 2. Format TSV
const tsv = formatPilotsData(result, 'tsv');
const tsvRows = tsv.trim().split('\n');

if (tsvRows[0] !== 'J215758 (C4)') {
  throw new Error(`TSV Header mismatch: "${tsvRows[0]}"`);
}
if (!tsvRows[1].includes('Chrysabelle Ellecon\tAP.MC\tCapsule - Chrysa...\tCapsule')) {
  throw new Error(`TSV Row 1 mismatch: "${tsvRows[1]}"`);
}
if (!tsvRows[2].includes('Ultimate Pikie\tAP.MC\tInto the Breach\tNemesis')) {
  throw new Error(`TSV Row 2 mismatch: "${tsvRows[2]}"`);
}

// 3. Format JSON
const jsonOutput = JSON.parse(formatPilotsData(result, 'json'));
if (jsonOutput.count !== 2 || jsonOutput.pilots[1].shipType !== 'Nemesis') {
  throw new Error(`JSON formatting error: ${JSON.stringify(jsonOutput)}`);
}

// 4. Format Markdown
const mdOutput = formatPilotsData(result, 'markdown');
if (!mdOutput.includes('### J215758 (C4)') || !mdOutput.includes('| Ultimate Pikie | AP.MC | Into the Breach | Nemesis |')) {
  throw new Error(`Markdown formatting error: ${mdOutput}`);
}

console.log('✅ End-to-End Pilots Simulation test passed!');
```

- [x] **Step 3: Run full suite of all project tests**

Run:
```bash
node tests/formatters.test.js
node tests/signatures-extractor.test.js
node tests/signatures-simulation.test.js
node tests/pilots-formatters.test.js
node tests/pilots-extractor.test.js
node tests/pilots-simulation.test.js
node tests/manifest-validation.js
node tests/end-to-end.test.js
```
Expected: All tests PASS with zero errors.

- [x] **Step 4: Commit test updates**

```bash
git add sandbox/test-map.html tests/pilots-simulation.test.js
git commit -m "test(pilots): add sandbox local panel and end-to-end simulation test"
```
