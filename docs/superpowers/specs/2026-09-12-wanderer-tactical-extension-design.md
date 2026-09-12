# Design Specification: NINE LIVES Tactical Extension (Wanderer Built-in AI Ingest)

- **Date:** 2026-09-12
- **Application Title:** NINE LIVES Console // Tactical Extension
- **Platform:** Google Chrome Extension (Manifest V3)
- **AI Engine:** Chrome Built-in AI (Prompt API / Gemini Nano via `LanguageModel`)
- **Visual Design:** AURA Tactical HUD (Derived from Stitch Project `1606960690905693982`, Screen `NINE LIVES Console - Tactical Extension Popup`)

---

## 1. Executive Summary & Problem Statement

EVE Online reconnaissance pilots and fleet commanders (FCs) frequently use third-party wormhole mapping tools (such as **Wanderer**) to map connected star systems, wormhole classes, signature IDs, and fleet intelligence. Ingesting this data into tactical consoles (like the **NINE LIVES Console**) previously required tedious manual transcription or unreliable OCR screenshots.

Because Wanderer renders wormhole map topology directly as an **SVG canvas** in the browser DOM, all system names, signatures, classes, and tags exist as text and vector elements on the page.

This Chrome Extension:
1. Verifies that the user is on an authorized Wanderer map instance (configurable in Settings).
2. Extracts and clusters SVG text nodes directly from the active Wanderer tab.
3. Passes the clustered nodes into Chrome's Built-in on-device AI (`LanguageModel` / Gemini Nano) via a specialized tactical parser prompt.
4. Generates a clean, standardized **Tab-Separated Values (TSV)** dataset by default (with toggleable JSON and Markdown table formats).
5. Automatically copies the formatted data to the clipboard for downstream application ingestion, accompanied by real-time streaming HUD telemetry and latency metrics.

---

## 2. Supported System Identifiers & Edge Cases

The parser handles all EVE Online system designation formats and mapping nuances:

1. **J-Space Wormhole Systems:** Standard 6-digit J-numbers (e.g. `J101020`, `J142923`, `J215758`).
2. **Nullsec Alphanumeric Systems:** Hyphenated and alphanumeric system codes (e.g. `38G6-L`, `N-K4Q0`, `U-7RBK`, `XPJ1-6`, `6-UCYU`).
3. **K-Space Named Systems:** Recognized Highsec, Lowsec, and unique systems (e.g. `Jita`, `Amamake`, `Thera`, `Poitot`, `Hek`, `Dodixie`).
4. **Missing Signature IDs (Home / Incomplete Nodes):** Nodes such as `J113907` displaying class/tags (`C5, B, C6`) without a 3-letter signature ID gracefully map the signature field to `-`.
5. **Pilot Counts:** Isolated numbers appearing adjacent to a system node (e.g. `"4"`) are parsed into a dedicated `Pilots` column.

---

## 3. Architecture & File Structure

```
AstrumExtension/
├── manifest.json                  # Manifest V3 configuration & permissions
├── icons/                         # Extension icons (16, 48, 128px)
├── popup/
│   ├── popup.html                 # 360px × 480px AURA tactical HUD
│   ├── popup.css                  # Monospace styling, scanlines, neon accents
│   └── popup.js                   # UI controller, workflow orchestrator, clipboard
├── content/
│   └── extractor.js               # Injected SVG DOM clustering and query script
├── lib/
│   └── ai.js                      # Chrome Prompt API (LanguageModel) adapter & prompt runner
├── settings/
│   ├── settings.html              # Target Wanderer URL & default format preferences
│   └── settings.js                # Chrome storage persistence
├── sandbox/
│   └── test-map.html              # Offline Wanderer SVG test map for local laptop testing
└── docs/
    └── superpowers/specs/
        └── 2026-09-12-wanderer-tactical-extension-design.md
```

---

## 4. Component Details

### 4.1 `manifest.json` (Manifest V3)
* **Manifest Version:** 3
* **Action:** `{ "default_popup": "popup/popup.html", "default_title": "NINE LIVES Tactical Extension" }`
* **Permissions:**
  * `"tabs"`: Required to read `tab.url` and verify the current tab against the configured Wanderer domain.
  * `"scripting"`: Required to execute `extractor.js` in the active Wanderer tab.
  * `"storage"`: Required to persist custom Wanderer URLs, default clipboard format, and telemetry settings.
  * `"clipboardWrite"`: Required to write parsed TSV data directly to the user's system clipboard.
* **Host Permissions:** `["<all_urls>"]` (allows matching custom self-hosted corp domains, IP addresses, or local instances).

### 4.2 Tab Verification & Settings
* When the popup opens, `popup.js` queries `chrome.tabs.query({ active: true, currentWindow: true })`.
* It cross-references `tab.url` with the stored Wanderer URL pattern (defaults to `*://*wanderer*/*` or customizable via the gear settings modal).
* **State Behavior:**
  * **Verified:** Header shows `● SYNCED // WANDERER DETECTED` (emerald pulse). System location ribbon displays current system info. `[ Get Wanderer Systems ]` is armed.
  * **Off-Grid:** Header shows `▲ OFF-GRID // NOT WANDERER` (amber/crimson). Ingest buttons display warning states with a direct shortcut button to open the Settings drawer or launch the local test map.

### 4.3 Content Script Extraction (`extractor.js`)
* Locates the primary Wanderer `<svg>` container.
* Traverses `<g>` element groupings or clusters text elements by geometric proximity.
* Extracts raw text tokens within that node container (filtering out UI controls, zoom buttons, and map background artifacts).
* Returns raw, unaligned candidate clusters representing what is visually present in each SVG node:
  ```json
  [
    "J101020 | LWT | C1 | D1.1 | H",
    "J113907 | C5 | B | C6 | 4",
    "38G6-L | ORX | D1.4 | L",
    "J142923 | IYR | C4 | D1.2 | C4 | C6"
  ]
  ```
  *(Note: Notice that in `J113907`, the second raw token is `C5` because there is no signature ID on the node. The AI handles semantic classification to prevent column shift).*

### 4.4 Chrome Built-in AI Engine & Column Alignment Guarantee (`lib/ai.js`)
* **Semantic Token Classification (Preventing Column Shift):**
  A naive string split on raw tokens would mistakenly put `C5` into the Signature column. The AI (paired with a regex validator) evaluates the semantics of each token:
  * `J113907` -> Matches System identifier pattern -> Assigned to **Column 1 (System)**.
  * Checks for 3-letter signature code (e.g. `LWT`, `IYR`) -> None present -> Injects `-` into **Column 2 (Signature)**.
  * `C5` -> Matches Wormhole Class pattern (`C[1-6]`) -> Assigned to **Column 3 (Class)**.
  * `B`, `C6` -> Assigned to **Column 4 (Tags / Statics)**.
  * `4` -> Matches isolated pilot digit -> Assigned to **Column 5 (Pilots)**.
* **Guaranteed Fixed TSV Output:**
  The output TSV columns are strictly locked to:
  `[0] System \t [1] Signature \t [2] Class \t [3] Tags \t [4] Pilots`
  This guarantees that downstream parsers calling `row.split('\t')` always receive consistent column indices, with empty/missing values represented by `-`.
* Uses Chrome 138+ standard `LanguageModel` Prompt API (`window.LanguageModel` / `globalThis.LanguageModel`).
* Verifies `LanguageModel.availability()`:
  * If `'readily'`, immediately creates session.
  * If `'after-download'`, shows visual download progress in the HUD: `[DOWNLOADING AI MODEL: XX%]`.
  * If unsupported, provides clear guidance on enabling Chrome Built-in AI flags (`chrome://flags/#prompt-api-for-gemini-nano`).
* **Session Configuration:**
  * `temperature: 0.1` (low temperature for deterministic, hallucination-free tabular extraction).
  * System Prompt establishes role as AURA Tactical Reconnaissance Parser and dictates schema.
* Streams response via `session.promptStreaming(...)` into the popup feed.

### 4.5 Clipboard Output Packaging & User Controls
* **Default Output:** Standard TSV format:
  ```tsv
  System	Signature	Class	Tags	Pilots
  J101020	LWT	C1	D1.1, H	-
  J113907	-	C5	B, C6	4
  38G6-L	ORX	Nullsec	D1.4, L	-
  J142923	IYR	C4	D1.2, C4, C6	-
  ```
* **Toggleable Formats:**
  * `[ TSV ]` (Default)
  * `[ JSON ]` (Direct API / Vue state ingestion)
  * `[ MD ]` (Markdown Table for Discord / Fleet notes)
* **Automatic Copy & Feedback:**
  * Automatically invokes `navigator.clipboard.writeText(formattedOutput)` upon generation completion.
  * UI flashes emerald HUD borders with notification: `[✓] COPIED TO CLIPBOARD // X SYSTEMS STAGED`.
  * Manual `[ COPY AGAIN ]` button provided for quick re-copying.

### 4.6 Offline Test Sandbox (`sandbox/test-map.html`)
* Bundles an authentic Wanderer SVG map mock containing J-systems, Nullsec systems (`38G6-L`, `N-K4Q0`), K-space exits (`Jita`), and edge cases (missing sigs, pilot counts).
* Allows immediate, fully offline end-to-end testing on any laptop or workstation without requiring live corp Wanderer credentials.

---

## 5. UI / UX Design Specifications (Stitch Match)

* **Dimensions:** 360px width × 480px height popup container.
* **Palette:**
  * Void: `#050b14` (Deep tactical background)
  * Surface / Card: `#091222` / `#0c182c`
  * Border: `#152945` (Subtle sci-fi structural frames)
  * Primary Accent: `#00e5ff` (Cyber cyan, HUD reticles, primary glyphs)
  * Emerald: `#10b981` (Synced / affirmative / clipboard copy success)
  * Amber: `#f59e0b` (Warnings / D-Scan telemetry)
  * Crimson: `#ef4444` (Hostile alerts / Off-grid notice)
  * Muted: `#64748b`
* **Typography:** `JetBrains Mono` / `monospace` for all telemetry values, system designations, and output tables. `Space Grotesk` for section labels.
* **HUD Flourishes:** Corner brackets (`hud-corners`), scanline texture overlay (`scanline`), cyan glowing borders (`tactical-glow`), and live latency telemetry (`LATENCY: 14ms`).

---

## 6. Verification & Testing Plan

1. **URL Validation Test:**
   * Test active tab with non-matching URL (e.g. `google.com`) -> Verify popup shows `▲ OFF-GRID` state.
   * Test with custom URL entered in Settings -> Verify popup switches to `● SYNCED`.
2. **SVG Extraction Test (Sandbox & Live):**
   * Load `sandbox/test-map.html` in browser -> Click `Get Wanderer Systems [W-SPACE]`.
   * Verify all node clusters extracted with zero DOM errors.
3. **AI Inference & Prompt Streaming Test:**
   * Verify `LanguageModel.create()` succeeds.
   * Verify streaming output appears line-by-line in `CONSOLE_RESPONSE`.
   * Verify `LATENCY: XXms` updates in the bottom ribbon.
4. **Data Accuracy & Edge Case Test:**
   * Check J-systems: e.g. `J101020` correctly paired with `LWT` and `C1`.
   * Check Nullsec IDs: e.g. `38G6-L`, `N-K4Q0` parsed with correct classes and tags.
   * Check missing signature: `J113907` signature column shows `-`, pilot count shows `4`.
5. **Clipboard Writing Test:**
   * Verify system clipboard receives formatted TSV data immediately on completion.
   * Paste into notepad/spreadsheet to confirm tab delimitations and column alignment.
