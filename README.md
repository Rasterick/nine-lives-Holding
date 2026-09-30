# NINE LIVES Console // Tactical Extension (Wanderer & zKillboard Ingest with Built-in AI)

A Manifest V3 Google Chrome extension that unifies tactical intelligence across **Wanderer wormhole chain maps** and **zKillboard / Eve-Kill target killboards**. Powered by **Chrome Built-in AI (`LanguageModel` / Gemini Nano)** with deterministic heuristic fallback, it extracts systems, signatures, pilots, gang attacker compositions, and hostile doctrine profiles, cross-referencing activity with your active wormhole chain.

---

## Features

- **AURA Tactical HUD**: A 360px × 480px sci-fi interface with dynamic context-aware mode switching:
  - **W-Space Mode**: Ingest Wanderer topology, cosmic signatures, and local roster.
  - **Target Intel Mode**: Ingest zKillboard/Eve-Kill pilot profiles, corp/alliance pages, solar systems, and individual killmail attacker gangs.
- **Smart Dual-Cap Harvesting**: Captures all kills in the **last 12 hours** (ideal for wormhole chains) while enforcing a 10-kill historical baseline and a 20-kill ceiling to eliminate clutter.
- **In-Extension Chain Cross-Referencing**: Caches the active Wanderer wormhole chain in extension memory and flags if a target's recent kills intersect your chain with hop distances (Home, 1 hop, 2 hops).
- **Active Chain Staleness Guard**: Automatically warns if cached Wanderer chain data is older than 30 minutes, providing a 1-click tab switch to refresh the map.
- **Gemini Nano Cognitive Synthesis**: Produces real-time combat threat evaluations, gang doctrine classifications (e.g. *Heavy Armor T3C Brawl + Heavy Interdiction*), and tactical wormhole precautions.
- **Dual Discord Reporting**:
  - **Flash Report (Popup)**: 1-click instant Discord markdown ping for fleet scouts.
  - **Enriched Military Report (Astrum Intel)**: Comprehensive combat briefing integrating chain depth and D-Scan tags.
- **Direct Astrum Uplink & Clipboard**: 1-click background API transmission to Astrum Intel with instant clipboard fallback.
- **Offline Test Sandboxes**:
  - `sandbox/test-map.html`: Mock Wanderer SVG map, signatures table, and roster.
  - `sandbox/test-zkill.html`: Mock zKillboard pilot combat profile and single killmail attackers table.

---

## How to Install & Load into Chrome

1. Open **Google Chrome**.
2. Navigate to `chrome://extensions` in your address bar.
3. Toggle on **Developer mode** in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the downloaded or cloned `AstrumExtension` directory (the folder where `manifest.json` is located).
6. The **NINE LIVES Console - Tactical Ingest** extension icon will now appear in your browser toolbar. Pin it for quick access!

---

## Chrome Built-in AI (Prompt API / Gemini Nano) Configuration

The extension uses Chrome's native on-device `LanguageModel` API. To ensure Gemini Nano is enabled on your machine:

1. In Chrome, open `chrome://flags/#prompt-api-for-gemini-nano` and set it to **Enabled**.
2. Open `chrome://flags/#optimization-guide-on-device-model` and set it to **Enabled BypassPerfRequirement**.
3. Relaunch Chrome.
4. Open `chrome://components` and check for **Optimization Guide On Device Model**. Click *Check for update* to ensure the model weights are downloaded.

*(Note: If the Prompt API is still downloading or disabled, the extension automatically utilizes its built-in local deterministic semantic classifier so you can still ingest data immediately without errors).*

---

## Testing Offline on Your Laptop

1. In Chrome, open `sandbox/test-map.html` in your extension folder (or click `[ TEST MAP SANDBOX ]` in the popup footer).
2. Click the **NINE LIVES Tactical Extension** icon in your toolbar.
3. Notice the status indicator shows `● SYNCED` and the active system is verified.
4. Click **`Get Wanderer Systems [W-SPACE]`**.
5. Watch the streaming analysis in `CONSOLE_RESPONSE`.
6. Notice the emerald flash: `[✓] 7 SYSTEMS INGESTED // COPIED TSV`.
7. Paste (`Ctrl + V`) into Notepad, Excel, or your target app to verify the tab-delimited columns!

---

## File Structure

```
AstrumExtension/
├── manifest.json              # Manifest V3 definitions & permissions
├── icons/                     # 16, 48, 128px tactical hex icon assets
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── popup/                     # 360px × 480px AURA tactical HUD
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/
│   └── extractor.js           # SVG DOM node clustering script
├── lib/
│   ├── ai.js                  # Prompt API engine & column-locking classifier
│   └── storage.js             # Settings persistence
├── settings/                  # Extension options page
│   ├── settings.html
│   └── settings.js
├── sandbox/
│   └── test-map.html          # Offline mock Wanderer map sandbox
└── tests/
    ├── manifest-validation.js # Automated manifest compliance test
    ├── extractor.test.js      # SVG clustering unit test
    ├── ai-parser.test.js      # Column alignment & formatting test
    └── end-to-end.test.js     # Full extraction test against real test map
```
