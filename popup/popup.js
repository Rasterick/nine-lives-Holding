// popup/popup.js
import { getSettings, saveSettings } from '../lib/storage.js';
import { parseWithChromeAI, formatTacticalData } from '../lib/ai.js';
import { extractWandererSvgData } from '../content/extractor.js';

// State variables
let currentTab = null;
let isWandererTab = false;
let parsedRecords = [];
let currentFormat = 'tsv';
let currentSettings = null;

// UI Elements
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const systemLoc = document.getElementById('systemLoc');
const systemSec = document.getElementById('systemSec');
const aiEngineLabel = document.getElementById('aiEngineLabel');
const btnSystems = document.getElementById('btnSystems');
const outputBox = document.getElementById('outputBox');
const timestampEl = document.getElementById('timestamp');
const latencyValue = document.getElementById('latencyValue');
const btnCopyAgain = document.getElementById('btnCopyAgain');
const lnkSandbox = document.getElementById('lnkSandbox');

// Settings Drawer Elements
const btnSettings = document.getElementById('btnSettings');
const settingsDrawer = document.getElementById('settingsDrawer');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const txtUrlPatterns = document.getElementById('txtUrlPatterns');
const selDefaultFormat = document.getElementById('selDefaultFormat');
const chkAutoCopy = document.getElementById('chkAutoCopy');

// Format Buttons
const fmtButtons = {
  tsv: document.getElementById('fmtTsv'),
  json: document.getElementById('fmtJson'),
  markdown: document.getElementById('fmtMd')
};

function updateTimestamp() {
  if (timestampEl) {
    const time = new Date().toISOString().substring(11, 19) + ' UTC';
    timestampEl.textContent = time;
  }
}

function matchesUrlPattern(url, pattern) {
  if (!url || !pattern) return false;
  // Convert standard glob wildcards to regex
  const escaped = pattern
    .trim()
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`, 'i');
  return regex.test(url);
}

async function verifyActiveTab() {
  currentSettings = await getSettings();
  currentFormat = currentSettings.defaultFormat || 'tsv';
  setActiveFormat(currentFormat);

  const LM = globalThis.LanguageModel || (typeof window !== 'undefined' && window.LanguageModel);
  aiEngineLabel.textContent = LM ? 'GEMINI NANO' : 'LOCAL ENGINE';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    if (!tab || !tab.url) {
      setOffGridState('No accessible active browser tab detected.');
      return;
    }

    const tabUrl = tab.url.toLowerCase();
    const isSandbox = tabUrl.includes('sandbox/test-map.html') || tabUrl.startsWith('chrome-extension://');
    const matchesPatterns = currentSettings.wandererUrlPatterns.some(pat => matchesUrlPattern(tab.url, pat));

    if (matchesPatterns || isSandbox || tabUrl.includes('wanderer')) {
      setSyncedState(tab);
    } else {
      setOffGridState(`Tab URL does not match Wanderer patterns:\n${tab.url.substring(0, 50)}...`);
    }
  } catch (err) {
    console.error('Failed to query tab:', err);
    setOffGridState('Unable to verify active tab status.');
  }
}

function setSyncedState(tab) {
  isWandererTab = true;
  statusBadge.className = 'status-badge state-synced';
  statusText.textContent = 'SYNCED';

  let hostname = 'WANDERER';
  try {
    const urlObj = new URL(tab.url);
    hostname = urlObj.hostname.toUpperCase();
  } catch {}

  systemLoc.textContent = hostname;
  systemSec.textContent = '-1.0 (CONNECTED)';
  systemSec.className = 'tag-crimson';

  btnSystems.disabled = false;
  btnSystems.classList.remove('btn-deactivated');
  btnSystems.classList.add('btn-active');
}

function setOffGridState(reason) {
  isWandererTab = false;
  statusBadge.className = 'status-badge state-offgrid';
  statusText.textContent = 'OFF-GRID';

  systemLoc.textContent = 'STANDALONE';
  systemSec.textContent = 'UNVERIFIED';

  outputBox.innerHTML = `
    <div style="color: #ef4444; font-weight: 700; margin-bottom: 4px;">
      ▲ OFF-GRID // NOT ON WANDERER
    </div>
    <div style="font-size: 8.5px; color: #94a3b8; line-height: 1.4;">
      ${reason}
    </div>
    <div style="margin-top: 6px; font-size: 8px; color: #00e5ff;">
      ➔ Click "[ TEST MAP SANDBOX ]" below to test offline on your laptop!
    </div>
  `;
}

function setActiveFormat(format) {
  currentFormat = format;
  for (const [fmt, btn] of Object.entries(fmtButtons)) {
    if (btn) {
      if (fmt === format) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  }
}

async function copyOutputToClipboard(text, notify = true) {
  try {
    await navigator.clipboard.writeText(text);
    if (notify) {
      outputBox.classList.add('success-flash');
      setTimeout(() => outputBox.classList.remove('success-flash'), 1200);
    }
    return true;
  } catch (err) {
    console.warn('Clipboard write failed:', err);
    return false;
  }
}

// Ingestion Action Handler
async function handleIngestWandererSystems() {
  if (!currentTab?.id) {
    alert('No active tab identified. Please navigate to Wanderer.');
    return;
  }

  const startTime = Date.now();
  updateTimestamp();

  outputBox.innerHTML = `
    <div style="color: #00e5ff; font-weight: 700;">
      ◈ SCANNING WANDERER SVG CANVAS...
    </div>
    <div style="font-size: 8.5px; color: #94a3b8; margin-top: 4px;">
      Querying vector nodes, signatures, and statics from active page...
    </div>
  `;

  try {
    let extraction = null;

    // 1. Check if on internal extension page (e.g. test sandbox) vs regular web page
    if (currentTab.url && currentTab.url.startsWith('chrome-extension://')) {
      try {
        extraction = await chrome.tabs.sendMessage(currentTab.id, { action: 'EXTRACT_WANDERER_SVG' });
      } catch (e) {
        console.warn('Message passing to extension tab failed, trying direct extractor:', e);
        extraction = extractWandererSvgData();
      }
    } else {
      // Execute in all frames to capture iframes if Wanderer is embedded
      const execResults = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id, allFrames: true },
        func: extractWandererSvgData
      });

      // Find frame that successfully extracted clusters
      const successful = execResults?.find(r => r.result?.success && r.result?.clusters?.length > 0);
      if (successful) {
        extraction = successful.result;
      } else {
        const best = execResults?.reduce((prev, r) => {
          const res = r.result;
          if (!res) return prev;
          const score = (res.debug?.svgCount || 0) * 10 + (res.debug?.allTextSamples?.length || 0);
          return score > prev.score ? { res, score } : prev;
        }, { res: execResults[0]?.result, score: -1 });
        extraction = best?.res;
      }
    }

    if (!extraction || !extraction.success || !extraction.clusters?.length) {
      const dbg = extraction?.debug;
      const samples = dbg?.svgSampleTexts?.length ? dbg.svgSampleTexts : (dbg?.pageSampleTexts || []);
      const dbgDetails = dbg ? `
        <div style="margin-top: 6px; padding: 6px; background: rgba(0,0,0,0.6); border: 1px solid #1e3a5f; border-radius: 4px; font-size: 8px; color: #94a3b8; line-height: 1.4;">
          <div style="color: #00e5ff; font-weight: 700; margin-bottom: 2px;">TACTICAL DIAGNOSTIC:</div>
          • URL: <span style="color:#cbd5e1;">${dbg.url ? dbg.url.substring(0, 45) + '...' : 'Unknown'}</span><br>
          • SVGs Found: <span style="color:#00e5ff;">${dbg.svgCount}</span> | Text Items: <span style="color:#00e5ff;">${dbg.svgTextCount || 0}</span><br>
          • Sample Canvas Text: <span style="color:#e2e8f0;">${samples.slice(0, 5).join(' / ') || 'None found in SVG canvas'}</span>
        </div>
      ` : '';

      outputBox.innerHTML = `
        <div style="color: #f59e0b; font-weight: 700;">
          [!] INGESTION ALERT // EMPTY CANVAS
        </div>
        <div style="font-size: 8.5px; color: #cbd5e1; margin-top: 4px;">
          ${extraction?.message || 'No system nodes found in SVG map. Make sure your Wanderer map tab is fully loaded.'}
        </div>
        ${dbgDetails}
      `;
      return;
    }

    // 2. Stream AI Parsing
    outputBox.innerHTML = `
      <div style="color: #10b981; font-weight: 700; display: flex; justify-content: space-between;">
        <span>⚡ AURA AI: PARSING ${extraction.systemCount} SYSTEMS...</span>
        <span style="font-size: 8px; color: #00e5ff;">STREAMING</span>
      </div>
      <div id="streamTarget" style="margin-top: 6px; font-size: 8.5px; color: #94a3b8; max-height: 80px; overflow: hidden;"></div>
    `;

    const streamTarget = document.getElementById('streamTarget');

    const records = await parseWithChromeAI(
      extraction.clusters,
      (chunk) => {
        if (streamTarget) {
          streamTarget.textContent += chunk;
        }
      },
      (progressPct) => {
        if (streamTarget) {
          streamTarget.textContent = `[DOWNLOADING TACTICAL AI MODEL: ${progressPct}%]`;
        }
      }
    );

    parsedRecords = records;
    const elapsed = Date.now() - startTime;
    latencyValue.textContent = `${elapsed}ms`;

    // 3. Format output
    const formattedData = formatTacticalData(records, currentFormat);

    // 4. Copy to Clipboard
    if (currentSettings.autoCopy) {
      await copyOutputToClipboard(formattedData, true);
    }

    // 5. Render Final Success Summary in Output Box
    outputBox.innerHTML = `
      <div style="color: #10b981; font-weight: 700; display: flex; justify-content: space-between;">
        <span>[✓] ${records.length} SYSTEMS INGESTED</span>
        <span style="font-size: 8px; background: rgba(16,185,129,0.2); color: #10b981; padding: 1px 4px; border-radius: 3px;">COPIED TSV</span>
      </div>
      <div style="font-size: 9px; color: #cbd5e1; margin-top: 4px;">
        • ${records.map(r => r.system).slice(0, 6).join(', ')}${records.length > 6 ? ` + ${records.length - 6} more` : ''}
      </div>
      <div style="font-size: 8px; color: #64748b; margin-top: 3px;">
        Clipboard ready for NINE LIVES Console &amp; spreadsheet paste.
      </div>
    `;

  } catch (err) {
    console.error('Ingestion failed:', err);
    outputBox.innerHTML = `
      <div style="color: #ef4444; font-weight: 700;">
        ❌ TELEMETRY EXTRACTION FAILED
      </div>
      <div style="font-size: 8.5px; color: #94a3b8; margin-top: 4px;">
        ${err.message || String(err)}
      </div>
    `;
  }
}

// Event Listeners
btnSystems.addEventListener('click', handleIngestWandererSystems);

btnCopyAgain.addEventListener('click', async () => {
  if (parsedRecords.length > 0) {
    const text = formatTacticalData(parsedRecords, currentFormat);
    await copyOutputToClipboard(text, true);
    btnCopyAgain.textContent = '✔ COPIED';
    setTimeout(() => { btnCopyAgain.textContent = '📋 COPY'; }, 1500);
  } else {
    alert('No telemetry data available to copy yet. Click "Get Wanderer Systems" first.');
  }
});

// Format Switchers
for (const [fmt, btn] of Object.entries(fmtButtons)) {
  if (btn) {
    btn.addEventListener('click', async () => {
      setActiveFormat(fmt);
      if (parsedRecords.length > 0) {
        const text = formatTacticalData(parsedRecords, fmt);
        await copyOutputToClipboard(text, true);
        outputBox.innerHTML = `
          <div style="color: #00e5ff; font-weight: 700;">
            [✓] SWITCHED FORMAT: ${fmt.toUpperCase()}
          </div>
          <div style="font-size: 8.5px; color: #cbd5e1; margin-top: 4px;">
            ${parsedRecords.length} systems re-formatted and copied to clipboard.
          </div>
        `;
      }
    });
  }
}

// Open Test Sandbox
lnkSandbox.addEventListener('click', (e) => {
  e.preventDefault();
  const sandboxUrl = chrome.runtime.getURL('sandbox/test-map.html');
  chrome.tabs.create({ url: sandboxUrl });
});

// Settings Drawer Handlers
btnSettings.addEventListener('click', async () => {
  currentSettings = await getSettings();
  txtUrlPatterns.value = (currentSettings.wandererUrlPatterns || []).join('\n');
  selDefaultFormat.value = currentSettings.defaultFormat || 'tsv';
  chkAutoCopy.checked = !!currentSettings.autoCopy;
  settingsDrawer.classList.remove('hidden');
});

btnCloseSettings.addEventListener('click', () => {
  settingsDrawer.classList.add('hidden');
});

btnSaveSettings.addEventListener('click', async () => {
  const patterns = txtUrlPatterns.value
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const newSettings = {
    ...currentSettings,
    wandererUrlPatterns: patterns.length > 0 ? patterns : currentSettings.wandererUrlPatterns,
    defaultFormat: selDefaultFormat.value,
    autoCopy: chkAutoCopy.checked
  };

  await saveSettings(newSettings);
  settingsDrawer.classList.add('hidden');
  await verifyActiveTab();
});

// Initial boot
document.addEventListener('DOMContentLoaded', () => {
  updateTimestamp();
  setInterval(updateTimestamp, 1000);
  verifyActiveTab();
});
