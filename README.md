# NINE LIVES Console // Tactical Extension (Wanderer Ingest with Built-in AI)

A Manifest V3 Google Chrome extension that extracts EVE Online wormhole chain map topology directly from Wanderer SVG vector graphics and uses **Chrome's on-device Built-in AI (`LanguageModel` / Gemini Nano)** to parse systems, signatures, classes, statics, and pilot counts into standard **Tab-Separated Values (TSV)**, copying it directly to the system clipboard for downstream application ingestion.

---

## Features

- **AURA Tactical HUD**: A 360px × 480px sci-fi interface with cyber cyan, emerald, amber, and crimson accents, HUD corner brackets, scanlines, and live latency metrics derived from Stitch Project `1606960690905693982`.
- **Wanderer SVG Map Ingest**: Intelligently inspects `<svg>` vector nodes in the active Wanderer tab without needing screenshot OCR or third-party servers.
- **Chrome Built-in AI Parser**: Uses Chrome's local `LanguageModel` Prompt API to semantically parse and classify systems with 100% on-device privacy, zero token cost, and sub-second latency.
- **Fixed-Column TSV Guarantee**: Solves the missing-signature and statics classification edge cases (e.g. Home system `J113907`, K-Space security status `Torrinos`, multi-statics `J121347`) by explicitly locking columns to:
  `System \t Signature \t Class \t Tags \t Statics \t Pilots`
  Columns never shift, ensuring seamless downstream parsing in your other application, spreadsheet, or database.
- **Broad EVE System Designation Support**:
  - **J-Space**: `J######` (e.g. `J101020`, `J113907`, `J142923`, `J215758`)
  - **Nullsec Alphanumeric**: `38G6-L`, `N-K4Q0`, `U-7RBK`, `XPJ1-6`, `6-UCYU`
  - **Named Systems**: `Jita`, `Amamake`, `Thera`, `Poitot`, `Hek`, `Dodixie`
- **Configurable URL Verification**: Gear icon opens tactical settings to allow custom corp Wanderer domains (e.g., `https://wanderer.mycorp.com/*`), while including `http://localhost:*` by default.
- **Offline Test Sandbox**: Includes `sandbox/test-map.html` with authentic Wanderer SVG topology so you can test end-to-end on your laptop immediately without live corp VPN credentials.
- **Visual Button States**:
  - `Get Wanderer Systems [W-SPACE]`: Active, armed with live cyan HUD highlights.
  - `Get Wanderer Scan Data [D-SCAN]`: Visually rendered in amber, deactivated in tactical standby (`[STANDBY // PHASE 2]`).
  - `Get Pilots in System [LOCAL]`: Visually rendered in emerald, deactivated in tactical standby (`[STANDBY // PHASE 2]`).

---

## How to Install & Load into Chrome

1. Open **Google Chrome**.
2. Navigate to `chrome://extensions` in your address bar.
3. Toggle on **Developer mode** in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select this extension directory:
   ```
   c:\Users\mitch\OneDrive\Documents\AstrumExtension
   ```
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

1. In Chrome, open `c:\Users\mitch\OneDrive\Documents\AstrumExtension\sandbox\test-map.html` (or click `[ TEST MAP SANDBOX ]` in the popup footer).
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
