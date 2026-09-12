# Wanderer Tactical Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready Chrome Extension (Manifest V3) with an AURA sci-fi tactical HUD (from Stitch) that extracts Wanderer SVG map nodes and uses Chrome's on-device Built-in AI (`LanguageModel` / Gemini Nano) to parse systems into fixed-column TSV (and JSON/MD) copied directly to the clipboard.

**Architecture:** A lightweight content script extracts `<svg>` map text nodes from the active Wanderer tab, groups them by visual node clusters, and passes them to the popup. The popup invokes Chrome's Built-in AI (`LanguageModel.create()`) to semantically classify tokens (J-space, Nullsec alphanumeric, K-space named systems, missing signatures, pilot counts) into strict TSV columns, streaming progress live to the HUD and copying to clipboard.

**Tech Stack:** Chrome Extension Manifest V3, Chrome Built-in AI (`window.LanguageModel`), Vanilla JavaScript (ES2022+), CSS3 with HUD animations & scanlines, HTML5.

**Spec:** [2026-09-12-wanderer-tactical-extension-design.md](file:///c:/Users/mitch/OneDrive/Documents/AstrumExtension/docs/superpowers/specs/2026-09-12-wanderer-tactical-extension-design.md)

## Global Constraints
- Manifest Version 3 strictly; no Manifest V2 deprecated APIs.
- All icon files declared in `manifest.json` must exist as real PNG files at 16x16, 48x48, and 128x128.
- Default output must be standard TSV with columns: `System\tSignature\tClass\tTags\tPilots`.
- Missing signatures (e.g. `J113907`) must be represented as `-` so columns never shift.
- Support J-space (`J######`), Nullsec (`38G6-L`, `N-K4Q0`), and named systems (`Jita`, `Thera`).
- Async/await used exclusively; no unhandled promise rejections.

---

### Task 1: Scaffolding, Icons & Manifest V3 Configuration

**Files:**
- Create: `manifest.json`
- Create: `icons/generate-icons.js` (script using Canvas/Node or direct PNG assets)
- Create: `icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png`
- Create: `lib/storage.js`
- Test: `tests/manifest-validation.js`

**Interfaces:**
- Consumes: Nothing
- Produces: Valid MV3 configuration, icon assets, and storage settings manager (`getSettings()`, `saveSettings(settings)`)

- [ ] **Step 1: Write test to validate Manifest V3 structure and icon existence**

```javascript
// tests/manifest-validation.js
import fs from 'fs';
import path from 'path';

function testManifest() {
  const manifestPath = path.resolve('manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('manifest.json missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3');
  if (!manifest.action?.default_popup) throw new Error('action.default_popup missing');

  const requiredPerms = ['tabs', 'scripting', 'storage', 'clipboardWrite'];
  for (const p of requiredPerms) {
    if (!manifest.permissions?.includes(p)) throw new Error(`Permission ${p} missing`);
  }

  for (const size of ['16', '48', '128']) {
    const iconPath = path.resolve(manifest.icons[size]);
    if (!fs.existsSync(iconPath)) throw new Error(`Icon ${size} missing at ${iconPath}`);
  }
  console.log('Manifest validation passed');
}

testManifest();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/manifest-validation.js`
Expected: FAIL (manifest.json missing)

- [ ] **Step 3: Generate icons and implement `manifest.json` & `lib/storage.js`**

Create `manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "NINE LIVES Console - Tactical Ingest",
  "version": "1.0.0",
  "description": "Tactical Wanderer wormhole map ingest powered by Chrome Built-in AI",
  "permissions": [
    "tabs",
    "scripting",
    "storage",
    "clipboardWrite"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "NINE LIVES Tactical Extension",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

Create `lib/storage.js`:
```javascript
export const DEFAULT_SETTINGS = {
  wandererUrlPatterns: ['*://*wanderer*/*', 'http://localhost:*/*', 'http://127.0.0.1:*/*'],
  defaultFormat: 'tsv', // 'tsv' | 'json' | 'markdown'
  autoCopy: true,
  includeKspace: true,
  includeNullsec: true
};

export async function getSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    const res = await chrome.storage.sync.get('settings');
    return { ...DEFAULT_SETTINGS, ...(res.settings || {}) };
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings) {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    await chrome.storage.sync.set({ settings });
  }
  return settings;
}
```

- [ ] **Step 4: Generate valid PNG icon assets (16, 48, 128px)**

Run node script or generate valid tactical hex icon PNGs in `icons/` folder.

- [ ] **Step 5: Run manifest validation test**

Run: `node tests/manifest-validation.js`
Expected: PASS

---

### Task 2: SVG Map Node Extractor Content Script

**Files:**
- Create: `content/extractor.js`
- Test: `tests/extractor.test.js`

**Interfaces:**
- Consumes: Active tab DOM with `<svg>` elements
- Produces: `extractWandererSvgData()` returning `{ success: boolean, clusters: string[], systemCount: number, error?: string }`

- [ ] **Step 1: Write test for `extractWandererSvgData` using simulated Wanderer SVG DOM**

```javascript
// tests/extractor.test.js
import { JSDOM } from 'jsdom';
import { extractWandererSvgData } from '../content/extractor.js';

const mockSvgHtml = `
  <html><body>
    <svg id="wanderer-map" width="800" height="600">
      <g class="node">
        <text class="sys-name">J101020</text>
        <text class="sig">LWT</text>
        <text class="class">C1</text>
        <text class="static">D1.1</text>
        <text class="tag">H</text>
      </g>
      <g class="node">
        <text class="sys-name">J113907</text>
        <text class="class">C5</text>
        <text class="tag">B</text>
        <text class="static">C6</text>
        <text class="pilots">4</text>
      </g>
      <g class="node">
        <text class="sys-name">38G6-L</text>
        <text class="sig">ORX</text>
        <text class="tag">D1.4</text>
        <text class="tag">L</text>
      </g>
    </svg>
  </body></html>
`;

const dom = new JSDOM(mockSvgHtml);
globalThis.document = dom.window.document;

const result = extractWandererSvgData();
if (!result.success || result.clusters.length !== 3) {
  throw new Error(`Extraction failed. Expected 3 clusters, got: ${JSON.stringify(result)}`);
}
console.log('Extractor test passed with clusters:', result.clusters);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/extractor.test.js`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement `content/extractor.js`**

Implement `content/extractor.js` with robust node finding, `<g>` grouping, spatial clustering fallback, and filtering:

```javascript
// content/extractor.js
export function extractWandererSvgData() {
  const svgs = Array.from(document.querySelectorAll('svg'));
  if (!svgs.length) {
    return { success: false, error: 'NO_SVG_CANVAS_FOUND', clusters: [] };
  }

  // Pick the primary map SVG canvas (largest area)
  const mapSvg = svgs.reduce((largest, svg) => {
    const rect = svg.getBoundingClientRect();
    const area = (rect.width || 100) * (rect.height || 100);
    return area > largest.area ? { svg, area } : largest;
  }, { svg: svgs[0], area: 0 }).svg;

  const nodeGroups = Array.from(mapSvg.querySelectorAll('g'));
  const clusters = [];
  const systemPattern = /^(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4}|[A-Z][a-z0-9]{3,15})$/;

  for (const group of nodeGroups) {
    const textEls = Array.from(group.querySelectorAll('text, tspan'));
    const tokens = textEls.map(t => t.textContent.trim()).filter(t => t.length > 0);
    
    // Check if group contains a system identifier
    const hasSystem = tokens.some(t => systemPattern.test(t));
    if (hasSystem && tokens.length > 0) {
      clusters.push(tokens.join(' | '));
    }
  }

  // Fallback: If no <g> grouping is used, cluster <text> elements by proximity or coordinates
  if (clusters.length === 0) {
    const allTextEls = Array.from(mapSvg.querySelectorAll('text, tspan'))
      .map(t => t.textContent.trim())
      .filter(t => t.length > 0);
    if (allTextEls.length > 0) {
      clusters.push(allTextEls.join(' | '));
    }
  }

  return {
    success: clusters.length > 0,
    clusters,
    systemCount: clusters.length,
    error: clusters.length === 0 ? 'NO_SYSTEM_NODES_IDENTIFIED' : undefined
  };
}

if (typeof window !== 'undefined') {
  window.extractWandererSvgData = extractWandererSvgData;
}
```

- [ ] **Step 4: Run extractor test to verify it passes**

Run: `node tests/extractor.test.js`
Expected: PASS

---

### Task 3: Chrome Built-in AI Engine & Fixed-Column Formatter

**Files:**
- Create: `lib/ai.js`
- Test: `tests/ai-parser.test.js`

**Interfaces:**
- Consumes: Raw cluster array from `extractor.js`
- Produces: `parseClustersWithAuraAI(clusters, options)` returning structured records and formatted TSV/JSON/MD

- [ ] **Step 1: Write test for semantic parsing and column alignment guarantee**

```javascript
// tests/ai-parser.test.js
import { formatTacticalData, validateAndAlignRow } from '../lib/ai.js';

// Test edge case: J113907 has no 3-letter signature
const sampleRow1 = validateAndAlignRow(['J113907', 'C5', 'B', 'C6', '4']);
if (sampleRow1.system !== 'J113907' || sampleRow1.signature !== '-' || sampleRow1.class !== 'C5' || sampleRow1.pilots !== '4') {
  throw new Error(`Row 1 alignment failed: ${JSON.stringify(sampleRow1)}`);
}

// Test Nullsec case: 38G6-L with signature ORX
const sampleRow2 = validateAndAlignRow(['38G6-L', 'ORX', 'Nullsec', 'D1.4', 'L']);
if (sampleRow2.system !== '38G6-L' || sampleRow2.signature !== 'ORX' || sampleRow2.class !== 'Nullsec') {
  throw new Error(`Row 2 alignment failed: ${JSON.stringify(sampleRow2)}`);
}

// Test TSV output
const tsv = formatTacticalData([sampleRow1, sampleRow2], 'tsv');
const lines = tsv.trim().split('\n');
if (lines[1] !== 'J113907\t-\tC5\tB, C6\t4') {
  throw new Error(`TSV output malformed: ${lines[1]}`);
}

console.log('Parser and Column Alignment validation passed!');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/ai-parser.test.js`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement `lib/ai.js`**

Implement semantic classification, Prompt API session runner, and formatters:
```javascript
// lib/ai.js
export function validateAndAlignRow(tokens) {
  let system = '-';
  let signature = '-';
  let systemClass = 'Unknown';
  const tags = [];
  let pilots = '-';

  const sysRegex = /^(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4}|[A-Z][a-z0-9]{3,15})$/;
  const sigRegex = /^[A-Z]{3}$/;
  const classRegex = /^(C[1-6]|C13|Highsec|Lowsec|Nullsec|Pochven|HS|LS|NS)$/i;
  const pilotRegex = /^\d{1,3}$/;

  for (const token of tokens) {
    if (system === '-' && sysRegex.test(token) && !classRegex.test(token)) {
      system = token;
    } else if (signature === '-' && sigRegex.test(token) && !classRegex.test(token)) {
      signature = token;
    } else if (systemClass === 'Unknown' && classRegex.test(token)) {
      systemClass = token;
    } else if (pilotRegex.test(token) && pilots === '-') {
      pilots = token;
    } else {
      tags.push(token);
    }
  }

  return {
    system,
    signature,
    class: systemClass,
    tags: tags.join(', ') || '-',
    pilots
  };
}

export function formatTacticalData(records, format = 'tsv') {
  if (format === 'json') {
    return JSON.stringify(records, null, 2);
  }
  if (format === 'markdown') {
    let md = '| System | Signature | Class | Tags | Pilots |\n| --- | --- | --- | --- | --- |\n';
    for (const r of records) {
      md += `| **${r.system}** | ${r.signature} | ${r.class} | ${r.tags} | ${r.pilots} |\n`;
    }
    return md;
  }
  // Default TSV
  let tsv = 'System\tSignature\tClass\tTags\tPilots\n';
  for (const r of records) {
    tsv += `${r.system}\t${r.signature}\t${r.class}\t${r.tags}\t${r.pilots}\n`;
  }
  return tsv;
}

export async function parseWithChromeAI(clusters, onChunk, onProgress) {
  // Built-in LanguageModel API in Chrome 138+
  const LM = globalThis.LanguageModel || (typeof window !== 'undefined' && window.LanguageModel);
  
  if (!LM) {
    // Graceful fallback to deterministic local parser if Prompt API not enabled
    console.warn('LanguageModel Prompt API not detected, utilizing local deterministic parser');
    const records = clusters.map(c => validateAndAlignRow(c.split(' | ').map(t => t.trim())));
    return records;
  }

  const availability = await LM.availability?.({
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }]
  });

  if (availability === 'unavailable') {
    throw new Error('Chrome Built-in AI model is unavailable on this device.');
  }

  const session = await LM.create({
    initialPrompts: [{
      role: 'system',
      content: `You are AURA, an EVE Online tactical reconnaissance intelligence parser.
Parse extracted raw SVG text clusters from a Wanderer wormhole map into structured records.
Each cluster represents a solar system node on the map.
For each cluster, output one line with tab-separated values:
System\tSignature\tClass\tTags\tPilots
Rules:
- System: J-space (e.g. J101020, J113907), Nullsec (e.g. 38G6-L, N-K4Q0), or named system (Jita, Thera).
- Signature: 3-letter code (e.g. LWT, IYR). If missing, output "-" to maintain column alignment.
- Class: C1-C6, Highsec, Lowsec, Nullsec.
- Tags: Statics (e.g. D1.1, C5), custom notes, or effects.
- Pilots: Number of pilots if present, else "-".`
    }],
    temperature: 0.1,
    monitor(m) {
      m.addEventListener?.('downloadprogress', (e) => {
        const pct = e.total ? Math.floor((e.loaded / e.total) * 100) : 0;
        if (onProgress) onProgress(pct);
      });
    }
  });

  const promptText = `Clusters to parse:\n` + clusters.join('\n');
  let fullOutput = '';
  
  if (session.promptStreaming) {
    for await (const chunk of session.promptStreaming(promptText)) {
      fullOutput += chunk;
      if (onChunk) onChunk(chunk);
    }
  } else {
    fullOutput = await session.prompt(promptText);
    if (onChunk) onChunk(fullOutput);
  }

  session.destroy?.();

  // Parse lines into verified records
  const lines = fullOutput.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.toLowerCase().startsWith('system\t'));
  const records = [];
  for (const line of lines) {
    const parts = line.split('\t').map(p => p.trim());
    if (parts.length >= 2) {
      records.push({
        system: parts[0] || '-',
        signature: parts[1] || '-',
        class: parts[2] || 'Unknown',
        tags: parts[3] || '-',
        pilots: parts[4] || '-'
      });
    }
  }

  return records.length > 0 ? records : clusters.map(c => validateAndAlignRow(c.split(' | ').map(t => t.trim())));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/ai-parser.test.js`
Expected: PASS

---

### Task 4: Offline Wanderer Mock Sandbox (`sandbox/test-map.html`)

**Files:**
- Create: `sandbox/test-map.html`
- Create: `sandbox/test-map.js`
- Test: Open in browser / headless DOM test

**Interfaces:**
- Consumes: Standalone HTML page with authentic Wanderer SVG map structure
- Produces: Testable Wanderer tab for developer extension validation

- [ ] **Step 1: Create `sandbox/test-map.html` with realistic SVG nodes**

Include:
- `J101020` (C1, sig `LWT`, statics `D1.1, H`)
- `J113907` (Home system, C5, no sig, tags `B, C6`, pilots `4`)
- `38G6-L` (Nullsec exit, sig `ORX`, tags `D1.4, L`)
- `N-K4Q0` (Nullsec system, sig `EEJ`, class `C6/Nullsec`, static `E1.4`)
- `J142923` (C4, sig `IYR`, tags `D1.2, C4, C6`)
- `Jita` (Highsec trade hub exit, sig `BMW`)

- [ ] **Step 2: Add quick test controls to verify DOM extraction in browser**

Add a small test banner at top: `[Wanderer Map Testbed // Run Extension Popup on this page]`.

---

### Task 5: 360px × 480px AURA Tactical HUD Popup

**Files:**
- Create: `popup/popup.html`
- Create: `popup/popup.css`
- Create: `popup/popup.js`
- Create: `settings/settings.html`
- Create: `settings/settings.js`

**Interfaces:**
- Consumes: `lib/storage.js`, `lib/ai.js`, `content/extractor.js`
- Produces: Interactive popup matching Stitch Screen `NINE LIVES Console - Tactical Extension Popup`

- [ ] **Step 1: Implement `popup/popup.html`**
  - Implement 360px container with HUD corners, scanline overlay, top telemetry ribbon, status pulse dot, gear icon, solar location, format toggle bar (`[ TSV ]` `[ JSON ]` `[ MD ]`), and `CONSOLE_RESPONSE` feed box.
  - Button 1 (`btnSystems`): Active, glowing cyan, fully wired to SVG extraction & Built-in AI.
  - Button 2 (`btnScan`): Rendered in authentic amber tactical style, but deactivated (`opacity-50 cursor-not-allowed`, badge: `[STANDBY // PHASE 2]`).
  - Button 3 (`btnPilots`): Rendered in authentic emerald tactical style, but deactivated (`opacity-50 cursor-not-allowed`, badge: `[STANDBY // PHASE 2]`).

- [ ] **Step 2: Implement `popup/popup.css`**
  - Extract CSS tokens: JetBrains Mono font, `#050b14` void background, `#00e5ff` cyan, `#10b981` emerald, `#f59e0b` amber, `#ef4444` crimson, scanline linear gradient, and `.hud-corners` pseudo-elements.

- [ ] **Step 3: Implement `popup/popup.js`**
  - Query active tab with `chrome.tabs.query({ active: true, currentWindow: true })`.
  - Validate URL against stored settings.
  - If valid: set status `● SYNCED` and arm buttons.
  - If invalid: set status `▲ OFF-GRID`, display tactical navigation guide, and offer test sandbox link.
  - Wire `btnSystems` click handler:
    1. Execute `chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractWandererSvgData })`.
    2. Pass clusters to `parseWithChromeAI` with streaming chunk updates into `outputBox`.
    3. Update latency in bottom ribbon (`LATENCY: ${elapsed}ms`).
    4. Auto-copy formatted TSV to `navigator.clipboard.writeText(...)`.
    5. Flash emerald border and update status: `[✓] COPIED TO CLIPBOARD // X SYSTEMS STAGED`.

- [ ] **Step 4: Implement `settings/settings.html` and `settings/settings.js`**
  - Modal or standalone options page allowing user to edit allowed Wanderer URLs (supporting custom corp domains and localhost) and set default clipboard format.

---

### Task 6: End-to-End Verification & Documentation

**Files:**
- Create: `README.md`
- Modify: `task.md`

- [ ] **Step 1: Test extension loading in Chrome Developer Mode**
  - Verify manifest loads without errors or warnings.
- [ ] **Step 2: Test on `sandbox/test-map.html`**
  - Open test map in browser, click extension popup, click `Get Wanderer Systems [W-SPACE]`.
  - Verify streaming output in `CONSOLE_RESPONSE` and verify TSV copied to clipboard.
- [ ] **Step 3: Test on live active Wanderer instance**
  - Navigate to user's active Wanderer instance, verify URL verification passes (`● SYNCED`), and run extraction.
- [ ] **Step 4: Write `README.md`**
  - Installation instructions, Chrome Built-in AI flags configuration guide (`chrome://flags/#prompt-api-for-gemini-nano`), and usage walkthrough.
