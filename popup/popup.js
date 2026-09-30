// popup/popup.js
import { getSettings, saveSettings } from '../lib/storage.js';
import { parseWithChromeAI, formatTacticalData, synthesizeZkillThreatWithAI } from '../lib/ai.js';
import { extractWandererSvgData } from '../content/extractor.js';
import { extractWandererSignatures } from '../content/signatures-extractor.js';
import { extractWandererPilots } from '../content/pilots-extractor.js';
import { extractZkillData } from '../content/zkill-extractor.js';
import { crossReferenceTargetWithChain, saveWandererChain, getCachedWandererChain } from '../lib/chain-crossref.js';
import { formatSignaturesData, formatPilotsData, formatDiscordFlashReport, formatZkillData } from '../lib/formatters.js';

// State variables
let currentTab = null;
let tabMode = 'wanderer'; // 'wanderer' | 'zkill' | 'offgrid'
let isWandererTab = false;
let parsedRecords = [];
let parsedSignaturesData = null;
let parsedPilotsData = null;
let parsedZkillData = null;
let parsedThreatSynthesis = null;
let parsedChainCrossRef = null;
let lastIngestType = 'systems';
let currentFormat = 'tsv';
let currentSettings = null;

// UI Elements - Core
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const systemLoc = document.getElementById('systemLoc');
const systemSec = document.getElementById('systemSec');
const aiEngineLabel = document.getElementById('aiEngineLabel');
const outputBox = document.getElementById('outputBox');
const timestampEl = document.getElementById('timestamp');
const latencyValue = document.getElementById('latencyValue');
const btnCopyAgain = document.getElementById('btnCopyAgain');
const lnkSandbox = document.getElementById('lnkSandbox');
const lnkZkillSandbox = document.getElementById('lnkZkillSandbox');

// UI Elements - Panels
const wandererActions = document.getElementById('wandererActions');
const zkillActions = document.getElementById('zkillActions');

// UI Elements - Wanderer
const btnSystems = document.getElementById('btnSystems');
const btnSignatures = document.getElementById('btnSignatures');
const btnPilots = document.getElementById('btnPilots');

// UI Elements - zKillboard
const btnZkillTarget = document.getElementById('btnZkillTarget');
const btnDiscordFlash = document.getElementById('btnDiscordFlash');
const btnTransmitAstrum = document.getElementById('btnTransmitAstrum');
const chainProximityCard = document.getElementById('chainProximityCard');
const proxTitle = document.getElementById('proxTitle');
const proxDetails = document.getElementById('proxDetails');

// Settings Drawer Elements
const btnSettings = document.getElementById('btnSettings');
const settingsDrawer = document.getElementById('settingsDrawer');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const txtUrlPatterns = document.getElementById('txtUrlPatterns');
const txtAstrumApiUrl = document.getElementById('txtAstrumApiUrl');
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
    const isWandererSandbox = tabUrl.includes('sandbox/test-map.html');
    const isZkillSandbox = tabUrl.includes('sandbox/test-zkill.html');
    const matchesPatterns = currentSettings.wandererUrlPatterns.some(pat => matchesUrlPattern(tab.url, pat));

    const isEveKill = tabUrl.includes('eve-kill.com') || tabUrl.includes('eve-kill.net') || tabUrl.includes('evekill.com');
    const isZkill = tabUrl.includes('zkillboard.com') || isEveKill || isZkillSandbox;
    const isWanderer = matchesPatterns || isWandererSandbox || tabUrl.includes('wanderer');

    if (isZkill) {
      setZkillState(tab);
    } else if (isWanderer) {
      setSyncedState(tab);
    } else {
      setOffGridState(`Tab URL does not match Wanderer, zKillboard, or Eve-Kill patterns:\n${tab.url.substring(0, 50)}...`);
    }
  } catch (err) {
    console.error('Failed to query tab:', err);
    setOffGridState('Unable to verify active tab status.');
  }
}

function setSyncedState(tab) {
  tabMode = 'wanderer';
  isWandererTab = true;

  wandererActions?.classList.remove('hidden');
  zkillActions?.classList.add('hidden');

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

  if (btnSystems) {
    btnSystems.disabled = false;
    btnSystems.classList.remove('btn-deactivated');
    btnSystems.classList.add('btn-active');
  }

  if (btnSignatures) {
    btnSignatures.disabled = false;
    btnSignatures.classList.remove('btn-deactivated');
    btnSignatures.classList.add('btn-active');
  }

  if (btnPilots) {
    btnPilots.disabled = false;
    btnPilots.classList.remove('btn-deactivated');
    btnPilots.classList.add('btn-active');
  }
}

function setZkillState(tab) {
  tabMode = 'zkill';
  isWandererTab = false;

  wandererActions?.classList.add('hidden');
  zkillActions?.classList.remove('hidden');

  const isEveKill = (tab.url || '').toLowerCase().includes('eve-kill') || (tab.url || '').toLowerCase().includes('evekill');
  statusBadge.className = 'status-badge state-synced';
  statusBadge.style.borderColor = 'rgba(239, 68, 68, 0.6)';
  statusText.textContent = isEveKill ? 'ARMED [EVE-KILL]' : 'ARMED [Z-KILL]';
  statusText.style.color = '#ef4444';

  let hostname = isEveKill ? 'EVE-KILL' : 'ZKILLBOARD';
  try {
    const urlObj = new URL(tab.url);
    hostname = urlObj.hostname.toUpperCase();
  } catch {}

  systemLoc.textContent = hostname;
  systemSec.textContent = 'TARGET INTEL';
  systemSec.className = 'tag-crimson';

  if (btnZkillTarget) {
    btnZkillTarget.disabled = false;
    btnZkillTarget.classList.remove('btn-deactivated');
    btnZkillTarget.classList.add('btn-active');
  }

  outputBox.innerHTML = `
    <div style="color: #ef4444; font-weight: 700; display: flex; justify-content: space-between;">
      <span>🎯 TARGET KILLBOARD DETECTED</span>
      <span style="font-size: 8px; color: #94a3b8;">${hostname}</span>
    </div>
    <div style="font-size: 8.5px; color: #cbd5e1; margin-top: 4px;">
      Click <strong>"Analyze Target Intel"</strong> to harvest recent kills, gang composition, and cross-reference with active wormhole chain.
    </div>
  `;
}

function setOffGridState(reason) {
  tabMode = 'offgrid';
  isWandererTab = false;

  wandererActions?.classList.remove('hidden');
  zkillActions?.classList.add('hidden');

  statusBadge.className = 'status-badge state-offgrid';
  statusBadge.style.borderColor = '';
  statusText.textContent = 'OFF-GRID';
  statusText.style.color = '';

  systemLoc.textContent = 'STANDALONE';
  systemSec.textContent = 'UNVERIFIED';

  if (btnSignatures) {
    btnSignatures.disabled = true;
    btnSignatures.classList.add('btn-deactivated');
    btnSignatures.classList.remove('btn-active');
  }

  outputBox.innerHTML = `
    <div style="color: #ef4444; font-weight: 700; margin-bottom: 4px;">
      ▲ OFF-GRID // UNVERIFIED TAB
    </div>
    <div style="font-size: 8.5px; color: #94a3b8; line-height: 1.4;">
      ${reason}
    </div>
    <div style="margin-top: 6px; font-size: 8px; color: #00e5ff;">
      ➔ Click "[ MOCK WANDERER ]" or "[ MOCK ZKILL ]" below to test offline on your laptop!
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
    lastIngestType = 'systems';
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
    await saveWandererChain(records);
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

// Signatures Ingestion Action Handler
async function handleIngestWandererSignatures() {
  if (!currentTab?.id) {
    alert('No active tab identified. Please navigate to Wanderer.');
    return;
  }

  const startTime = Date.now();
  updateTimestamp();

  outputBox.innerHTML = `
    <div style="color: #f59e0b; font-weight: 700;">
      ◈ EXTRACTING SYSTEM SIGNATURES...
    </div>
    <div style="font-size: 8.5px; color: #94a3b8; margin-top: 4px;">
      Querying open Signatures panel on active Wanderer page...
    </div>
  `;

  try {
    let extraction = null;

    if (currentTab.url && currentTab.url.startsWith('chrome-extension://')) {
      try {
        extraction = await chrome.tabs.sendMessage(currentTab.id, { action: 'EXTRACT_WANDERER_SIGNATURES' });
      } catch (e) {
        extraction = extractWandererSignatures();
      }
    } else {
      const execResults = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id, allFrames: true },
        func: extractWandererSignatures
      });

      const successful = execResults?.find(r => r.result?.success && r.result?.signatures?.length > 0);
      extraction = successful?.result || execResults?.[0]?.result;
    }

    if (!extraction || !extraction.success || !extraction.signatures?.length) {
      const dbg = extraction?.debug;
      const dbgDetails = dbg ? `
        <div style="margin-top: 6px; padding: 6px; background: rgba(0,0,0,0.6); border: 1px solid #1e3a5f; border-radius: 4px; font-size: 8px; color: #94a3b8; line-height: 1.4;">
          <div style="color: #f59e0b; font-weight: 700; margin-bottom: 2px;">TACTICAL DIAGNOSTIC:</div>
          • URL: <span style="color:#cbd5e1;">${dbg.url ? dbg.url.substring(0, 45) + '...' : 'Unknown'}</span><br>
          • Header Found: <span style="color:${dbg.headerFound ? '#10b981' : '#ef4444'}; font-weight:700;">${dbg.headerFound ? 'YES' : 'NO'}</span> ${dbg.headerTextSample ? `("${dbg.headerTextSample}")` : ''}<br>
          • Table Headers: <span style="color:#00e5ff;">${dbg.tableHeadersSample?.join(' / ') || 'None found'}</span><br>
          • Strategy: <span style="color:#e2e8f0;">${dbg.strategyUsed || 'None'}</span>
          ${dbg.exception ? `<br>• Error: <span style="color:#ef4444;">${dbg.exception.substring(0, 80)}</span>` : ''}
        </div>
      ` : '';

      outputBox.innerHTML = `
        <div style="color: #f59e0b; font-weight: 700;">
          [!] NO SIGNATURES DETECTED
        </div>
        <div style="font-size: 8.5px; color: #cbd5e1; margin-top: 4px;">
          ${extraction?.message || 'Please click on a system in Wanderer to open its Signatures table, then try again.'}
        </div>
        ${dbgDetails}
      `;
      return;
    }

    lastIngestType = 'signatures';
    parsedSignaturesData = extraction;

    const formattedData = formatSignaturesData(extraction, currentFormat);
    if (currentSettings?.autoCopy !== false) {
      await copyOutputToClipboard(formattedData, true);
    }

    const elapsed = Date.now() - startTime;
    if (latencyValue) {
      latencyValue.textContent = `${elapsed}ms`;
    }

    outputBox.innerHTML = `
      <div style="color: #10b981; font-weight: 700; display: flex; justify-content: space-between;">
        <span>[✓] ${extraction.signatures.length} SIGNATURES INGESTED</span>
        <span style="font-size: 8px; background: rgba(245,158,11,0.2); color: #f59e0b; padding: 1px 4px; border-radius: 3px;">${extraction.system} (${extraction.class})</span>
      </div>
      <pre style="font-family: inherit; font-size: 8px; color: #cbd5e1; white-space: pre-wrap; margin: 4px 0 0 0; max-height: 80px; overflow-y: auto;">${formattedData}</pre>
    `;

  } catch (err) {
    console.error('Signatures ingestion failed:', err);
    outputBox.innerHTML = `
      <div style="color: #ef4444; font-weight: 700;">
        ❌ SIGNATURES EXTRACTION FAILED
      </div>
      <div style="font-size: 8.5px; color: #94a3b8; margin-top: 4px;">
        ${err.message || String(err)}
      </div>
    `;
  }
}

// Local Pilots Ingestion Action Handler
async function handleIngestWandererPilots() {
  if (!currentTab?.id) {
    alert('No active tab identified. Please navigate to Wanderer.');
    return;
  }

  const startTime = Date.now();
  updateTimestamp();

  outputBox.innerHTML = `
    <div style="color: #10b981; font-weight: 700;">
      ◈ EXTRACTING LOCAL PILOTS...
    </div>
    <div style="font-size: 8.5px; color: #94a3b8; margin-top: 4px;">
      Querying open Local roster panel on active Wanderer page...
    </div>
  `;

  try {
    let extraction = null;

    if (currentTab.url && currentTab.url.startsWith('chrome-extension://')) {
      try {
        extraction = await chrome.tabs.sendMessage(currentTab.id, { action: 'EXTRACT_WANDERER_PILOTS' });
      } catch (e) {
        extraction = await extractWandererPilots();
      }
    } else {
      const execResults = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id, allFrames: true },
        func: extractWandererPilots
      });

      const successful = execResults?.find(r => r.result?.success && (r.result?.pilots?.length > 0 || r.result?.count === 0));
      extraction = successful?.result || execResults?.[0]?.result;
    }

    if (!extraction || !extraction.success || !extraction.pilots?.length) {
      const isClear = extraction?.count === 0;
      const dbg = extraction?.debug;
      const dbgDetails = dbg ? `
        <div style="margin-top: 6px; padding: 6px; background: rgba(0,0,0,0.6); border: 1px solid #1e3a5f; border-radius: 4px; font-size: 8px; color: #94a3b8; line-height: 1.4;">
          <div style="color: #00e5ff; font-weight: 700; margin-bottom: 2px;">TACTICAL DIAGNOSTIC:</div>
          • Header: <span style="color:#fff;">${dbg.headerText || 'None'}</span> | Count: <span style="color:#00e5ff;">${dbg.localCount !== null ? dbg.localCount : 'Unknown'}</span><br>
          • Portraits Found: <span style="color:#00e5ff;">${dbg.portraitsFound || 0}</span> | Pilots Scanned: <span style="color:#00e5ff;">${dbg.pilotsFound || 0}</span><br>
          • Card Container: <span style="color:#e2e8f0;">&lt;${dbg.localCardTag}&gt; ${dbg.localCardClass ? `.${dbg.localCardClass}` : ''}</span>
          ${dbg.exception ? `<br>• Error: <span style="color:#ef4444;">${dbg.exception}</span>` : ''}
        </div>
      ` : '';

      outputBox.innerHTML = `
        <div style="color: #f59e0b; font-weight: 700;">
          ${isClear ? '[!] LOCAL CLEAR // NO PILOTS IN SYSTEM' : '[!] NO LOCAL PILOTS DETECTED'}
        </div>
        <div style="font-size: 8.5px; color: #cbd5e1; margin-top: 4px;">
          ${isClear 
            ? `Wanderer reports 0 pilots active in ${extraction?.system || 'Unknown'} (${extraction?.class || 'Unknown'}). Anti-table shield active: zero stray signatures or structures captured.`
            : (extraction?.message || 'Please ensure Wanderer has an active system with the Local roster open, then try again.')}
        </div>
        <div style="margin-top: 6px; padding: 4px 6px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 4px; font-size: 8px; color: #10b981;">
          ✔ Active System Verified: <span style="font-weight: 700; color: #fff;">${extraction?.system || 'Unknown'} (${extraction?.class || 'Unknown'})</span>
        </div>
        ${dbgDetails}
      `;
      return;
    }

    lastIngestType = 'pilots';
    parsedPilotsData = extraction;

    const formattedData = formatPilotsData(extraction, currentFormat);
    if (currentSettings?.autoCopy !== false) {
      await copyOutputToClipboard(formattedData, true);
    }

    const elapsed = Date.now() - startTime;
    if (latencyValue) {
      latencyValue.textContent = `${elapsed}ms`;
    }

    const hasUncheckedWarning = !extraction.autoCheckedShipNames && (
      extraction.shipNamesToggled === false ||
      (extraction.pilots.length > 0 && extraction.pilots.every(p => p.shipName && p.shipType && p.shipName.toLowerCase() === p.shipType.toLowerCase() && p.shipType !== 'Capsule'))
    );

    const autoCheckedNotice = extraction.autoCheckedShipNames ? `
      <div style="margin-top: 4px; padding: 3px 6px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.35); border-radius: 4px; font-size: 8px; color: #34d399; line-height: 1.3;">
        ⚡ <strong>Auto-Checked:</strong> Enabled <em>"Ship name" [✓]</em> in Wanderer to capture full ship names &amp; custom tags.
      </div>
    ` : '';

    const shipNameNotice = hasUncheckedWarning ? `
      <div style="margin-top: 4px; padding: 4px 6px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 4px; font-size: 8px; color: #fbbf24; line-height: 1.3;">
        ⚠️ <strong>Ship name is unchecked in Wanderer:</strong> Keep <em>"Ship name" [✓]</em> checked in Wanderer's Local header to capture custom fleet ship tags (e.g. ☜☠☞ Palliser).
      </div>
    ` : '';

    outputBox.innerHTML = `
      <div style="color: #10b981; font-weight: 700; display: flex; justify-content: space-between;">
        <span>[✓] ${extraction.count === 0 ? 'LOCAL CLEAR (0 PILOTS)' : `${extraction.pilots.length} PILOTS INGESTED`}</span>
        <span style="font-size: 8px; background: rgba(16,185,129,0.2); color: #10b981; padding: 1px 4px; border-radius: 3px;">${extraction.system} (${extraction.class})</span>
      </div>
      ${autoCheckedNotice}
      ${shipNameNotice}
      <pre style="font-family: inherit; font-size: 8px; color: #cbd5e1; white-space: pre-wrap; margin: 4px 0 0 0; max-height: 80px; overflow-y: auto;">${formattedData}</pre>
    `;

  } catch (err) {
    console.error('Pilots ingestion failed:', err);
    outputBox.innerHTML = `
      <div style="color: #ef4444; font-weight: 700;">
        ❌ PILOTS EXTRACTION FAILED
      </div>
      <div style="font-size: 8.5px; color: #94a3b8; margin-top: 4px;">
        ${err.message || String(err)}
      </div>
    `;
  }
}

// Event Listeners
btnSystems.addEventListener('click', handleIngestWandererSystems);
if (btnSignatures) {
  btnSignatures.addEventListener('click', handleIngestWandererSignatures);
}
if (btnPilots) {
  btnPilots.addEventListener('click', handleIngestWandererPilots);

  btnPilots.addEventListener('mouseenter', () => {
    if (!lastIngestType && outputBox) {
      outputBox.innerHTML = `
        <div style="color: #10b981; font-weight: 700;">
          ◈ TACTICAL SCANNER: LOCAL PILOTS [LOCAL]
        </div>
        <div style="font-size: 8.5px; color: #cbd5e1; margin-top: 4px; line-height: 1.4;">
          Scrapes pilot identities, corp tickers, ship types &amp; custom fleet tags.<br>
          <span style="color: #38bdf8;">💡 <strong>Pro-Tip:</strong> Ensure <em>"Ship name" [✓]</em> is checked in Wanderer for custom tags (e.g. ☜☠☞ Palliser). The extension will also attempt to auto-check it if needed.</span>
        </div>
      `;
    }
  });

  btnPilots.addEventListener('mouseleave', () => {
    if (!lastIngestType && outputBox) {
      outputBox.innerHTML = `
        <div style="color: #64748b; font-size: 8.5px; line-height: 1.4;">
          &gt; AURA TACTICAL EXTENSION INITIALIZED<br>
          &gt; SELECT AN ACTION ABOVE TO INGEST WANDERER CHAIN OR PILOTS
        </div>
      `;
    }
  });
}

// Handle zKillboard Target Ingestion
async function handleIngestZkillTarget() {
  if (!currentTab?.id) {
    alert('No active tab identified. Please navigate to zKillboard or Eve-Kill.');
    return;
  }

  const startTime = Date.now();
  updateTimestamp();

  outputBox.innerHTML = `
    <div style="color: #ef4444; font-weight: 700;">
      ◈ SCANNING TARGET KILLBOARD DOM...
    </div>
    <div style="font-size: 8.5px; color: #94a3b8; margin-top: 4px;">
      Harvesting combat events, gang attackers, and checking active chain proximity...
    </div>
  `;

  try {
    let extraction = null;

    if (currentTab.url && currentTab.url.includes('sandbox/test-zkill.html')) {
      const execResults = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: extractZkillData
      });
      extraction = execResults?.[0]?.result;
    } else {
      const execResults = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id, allFrames: false },
        func: extractZkillData
      });
      extraction = execResults?.[0]?.result;
    }

    if (!extraction || !extraction.success) {
      outputBox.innerHTML = `
        <div style="color: #f59e0b; font-weight: 700;">
          [!] TARGET EXTRACTION ALERT
        </div>
        <div style="font-size: 8.5px; color: #cbd5e1; margin-top: 4px;">
          ${extraction?.error || 'Unable to parse killmail elements from page. Ensure zKillboard/Eve-Kill table is loaded.'}
        </div>
      `;
      return;
    }

    // 1. Cross-reference target systems against cached Wanderer chain
    const crossRef = await crossReferenceTargetWithChain(extraction.uniqueSystems, extraction.recentEvents);
    parsedChainCrossRef = crossRef;

    // Update Proximity Card UI
    if (chainProximityCard) {
      chainProximityCard.classList.remove('hidden', 'alert-critical', 'alert-elevated');
      
      let stalenessHtml = '';
      if (crossRef.isStale) {
        stalenessHtml = `
          <div class="prox-staleness-warning">
            <span>⚠️ Chain data is ${crossRef.chainAgeMinutes !== null ? crossRef.chainAgeMinutes + 'm' : 'unknown'} old</span>
            <button id="btnRefreshChain" class="btn-refresh-chain">REFRESH WANDERER</button>
          </div>
        `;
      }

      if (crossRef.hasIntersection) {
        if (crossRef.highestThreatLevel === 'CRITICAL_HOME') {
          chainProximityCard.classList.add('alert-critical');
          proxTitle.innerHTML = `<span style="color:#ef4444;">🔥 CRITICAL // HOME SYSTEM BREACH</span>`;
          proxDetails.innerHTML = `Target was active directly in <strong>HOME SYSTEM</strong>! Recent activity recorded.<br>${stalenessHtml}`;
        } else if (crossRef.highestThreatLevel === 'CRITICAL') {
          chainProximityCard.classList.add('alert-critical');
          proxTitle.innerHTML = `<span style="color:#ef4444;">🚨 RED ALERT // 1 HOP FROM HOME</span>`;
          proxDetails.innerHTML = `Target active in <strong>${crossRef.hotSystems.map(h => h.system).join(', ')}</strong> (1 hop from Home)!<br>${stalenessHtml}`;
        } else if (crossRef.highestThreatLevel === 'ELEVATED') {
          chainProximityCard.classList.add('alert-elevated');
          proxTitle.innerHTML = `<span style="color:#f59e0b;">⚠️ ELEVATED // 2 HOPS FROM HOME</span>`;
          proxDetails.innerHTML = `Target active in <strong>${crossRef.hotSystems.map(h => h.system).join(', ')}</strong> (2 hops away).<br>${stalenessHtml}`;
        } else {
          proxTitle.innerHTML = `📡 CHAIN TELEMETRY INTERSECTION`;
          proxDetails.innerHTML = `Activity matches chain node(s): <strong>${crossRef.hotSystems.map(h => h.system).join(', ')}</strong>.<br>${stalenessHtml}`;
        }
      } else {
        proxTitle.innerHTML = `🛡️ NO CHAIN INTERSECTION DETECTED`;
        proxDetails.innerHTML = `Target systems do not intersect your active Wanderer chain nodes.<br>${stalenessHtml}`;
      }

      // Add listener to refresh chain button if present
      const refreshBtn = document.getElementById('btnRefreshChain');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
          const [wandererTab] = await chrome.tabs.query({ url: '*://*wanderer*/*' });
          if (wandererTab?.id) {
            chrome.tabs.update(wandererTab.id, { active: true });
          } else {
            alert('Please open or focus your Wanderer tab to re-sync chain data.');
          }
        });
      }
    }

    // 2. Synthesize Threat with AI (Gemini Nano or Heuristic Fallback)
    const synthesis = await synthesizeZkillThreatWithAI(extraction);
    parsedThreatSynthesis = synthesis;
    parsedZkillData = extraction;
    lastIngestType = 'zkill';

    const elapsed = Date.now() - startTime;
    latencyValue.textContent = `${elapsed}ms`;

    // 3. Format data
    const formattedData = formatZkillData(extraction, synthesis, crossRef, currentFormat);

    // 4. Auto-copy if enabled
    if (currentSettings?.autoCopy) {
      await copyOutputToClipboard(formattedData, true);
    }

    // 5. Render Console Response
    const targetName = extraction.entityName || (extraction.victim ? `${extraction.victim.name}'s loss` : 'Target');
    const threatBadgeColor = synthesis.threatIndex >= 8 ? '#ef4444' : (synthesis.threatIndex >= 5 ? '#f59e0b' : '#10b981');
    const threatTagBg = synthesis.threatIndex >= 8 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)';

    outputBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px;">
        <span style="color: #fff; font-weight: 700; font-size: 9.5px;">${targetName}</span>
        <span style="background: ${threatTagBg}; color: ${threatBadgeColor}; font-size: 8px; font-weight: 800; padding: 1px 5px; border-radius: 3px; border: 1px solid ${threatBadgeColor};">
          THREAT: ${synthesis.threatIndex}/10
        </span>
      </div>
      <div style="font-size: 8.5px; color: #00e5ff; margin-top: 4px;">
        ⚡ DOCTRINE: <strong style="color: #fff;">${synthesis.doctrine}</strong> (${synthesis.gangSizeDesc})
      </div>
      <div style="font-size: 8px; color: #94a3b8; margin-top: 2px;">
        • Ships: <span style="color:#cbd5e1;">${extraction.shipsObserved?.slice(0, 5).join(', ') || 'Unknown'}</span><br>
        • Scope: <span style="color:#cbd5e1;">${extraction.filterReason || extraction.sampleCount + ' events'}</span>
      </div>
      <div style="font-size: 8px; color: #f59e0b; margin-top: 4px; border-left: 2px solid ${threatBadgeColor}; padding-left: 5px;">
        ${synthesis.precautions?.[0] || 'Maintain gate perches and D-scan vigilance.'}
      </div>
      <div style="margin-top: 5px; display: flex; justify-content: space-between; font-size: 7.5px; color: #64748b;">
        <span>COPIED ${currentFormat.toUpperCase()}</span>
        <span style="color: #00e5ff;">➔ USE QUICK ACTIONS ABOVE</span>
      </div>
    `;

  } catch (err) {
    console.error('Target ingestion failed:', err);
    outputBox.innerHTML = `
      <div style="color: #ef4444; font-weight: 700;">
        ❌ TARGET EXTRACTION FAILED
      </div>
      <div style="font-size: 8.5px; color: #94a3b8; margin-top: 4px;">
        ${err.message || String(err)}
      </div>
    `;
  }
}

async function handleCopyDiscordFlash() {
  if (!parsedZkillData) {
    await handleIngestZkillTarget();
    if (!parsedZkillData) return;
  }
  const flashReport = formatDiscordFlashReport(parsedZkillData, parsedThreatSynthesis, parsedChainCrossRef);
  await copyOutputToClipboard(flashReport, true);
  outputBox.innerHTML = `
    <div style="color: #10b981; font-weight: 700; display: flex; justify-content: space-between;">
      <span>[✓] COPIED FLASH DISCORD REPORT</span>
      <span style="font-size: 8px; color: #00e5ff;">MARKDOWN</span>
    </div>
    <pre style="font-family: inherit; font-size: 8px; color: #cbd5e1; white-space: pre-wrap; margin: 4px 0 0 0; max-height: 80px; overflow-y: auto;">${flashReport}</pre>
    <div style="font-size: 8px; color: #64748b; margin-top: 3px;">
      Ready to paste into Discord tactical or intel channels.
    </div>
  `;
}

async function handleTransmitToAstrum() {
  if (!parsedZkillData) {
    await handleIngestZkillTarget();
    if (!parsedZkillData) return;
  }

  let payloadObj = null;
  try {
    payloadObj = JSON.parse(formatZkillData(parsedZkillData, parsedThreatSynthesis, parsedChainCrossRef, 'json'));
  } catch {
    payloadObj = {};
  }

  // Automatically attach cached Wanderer chain if present in extension storage
  try {
    const chainCache = await getCachedWandererChain();
    if (chainCache?.chain && Array.isArray(chainCache.chain) && chainCache.chain.length > 0) {
      payloadObj.chainMap = {
        home_system: { name: 'J215758' },
        synced_at: chainCache.timestamp ? new Date(chainCache.timestamp).toISOString() : new Date().toISOString(),
        systems: chainCache.chain.map(c => {
          const sysName = (c.system || c.name || '').toUpperCase();
          const isHome = sysName === 'J215758' || sysName === 'J113907' || c.tag === 'PG' || c.isHome;
          return {
            name: c.system || c.name,
            class_raw: c.class || c.class_raw || 'W-Space',
            tag: c.tag || c.tags || '-',
            hops: typeof c.hops === 'number' ? c.hops : (isHome ? 0 : 1),
            pilots: c.pilots || 0,
            statics: c.statics || '-'
          };
        })
      };
    }
  } catch (err) {
    console.warn('Could not bundle chainMap:', err);
  }

  const payload = JSON.stringify(payloadObj);
  const settings = await getSettings();
  const endpoint = settings.astrumApiUrl || 'http://localhost:8000/api/intel/tactical-ingest';
  
  outputBox.innerHTML = `
    <div style="color: #00e5ff; font-weight: 700;">
      🚀 TRANSMITTING TELEMETRY TO ASTRUM INTEL...
    </div>
    <div style="font-size: 8px; color: #94a3b8; margin-top: 2px;">
      Dispatching payload to ${endpoint}...
    </div>
  `;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: payload,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const resJson = await response.json().catch(() => null);
      const hubUrl = resJson?.redirect_url || (endpoint.replace(/\/api\/intel\/tactical-ingest.*$/i, '/intel/tactical-hub'));

      outputBox.innerHTML = `
        <div style="color: #10b981; font-weight: 700;">
          [✓] TRANSMISSION CONFIRMED // ASTRUM INTEL
        </div>
        <div style="font-size: 8.5px; color: #cbd5e1; margin-top: 4px;">
          Telemetry successfully ingested into Astrum Operations Hub.
        </div>
        <div style="margin-top: 5px;">
          <a href="${hubUrl}" target="_blank" style="color: #00e5ff; font-size: 8px; font-weight: 700; text-decoration: underline;">
            ➔ OPEN TACTICAL HUB
          </a>
        </div>
      `;
    } else {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
  } catch (err) {
    outputBox.innerHTML = `
      <div style="color: #f59e0b; font-weight: 700;">
        ⚠️ ASTRUM API UPLINK OFFLINE
      </div>
      <div style="font-size: 8.5px; color: #cbd5e1; margin-top: 4px;">
        Could not reach ${endpoint} (${err.message || 'Connection refused'}).
      </div>
      <div style="font-size: 8px; color: #94a3b8; margin-top: 3px;">
        ⚙️ Check your Live Server URL in <strong>Settings (⚙️)</strong>.
      </div>
      <div style="font-size: 8px; color: #00e5ff; margin-top: 3px;">
        💡 Telemetry JSON is safely copied to clipboard! Paste into Ingest Modal.
      </div>
    `;
    await copyOutputToClipboard(payload, false);
  }
}

// Copy Again Button Handler
btnCopyAgain.addEventListener('click', async () => {
  if (lastIngestType === 'zkill' && parsedZkillData) {
    const text = formatZkillData(parsedZkillData, parsedThreatSynthesis, parsedChainCrossRef, currentFormat);
    await copyOutputToClipboard(text, true);
    btnCopyAgain.textContent = '✔ COPIED';
    setTimeout(() => { btnCopyAgain.textContent = '📋 COPY'; }, 1500);
  } else if (lastIngestType === 'pilots' && parsedPilotsData) {
    const text = formatPilotsData(parsedPilotsData, currentFormat);
    await copyOutputToClipboard(text, true);
    btnCopyAgain.textContent = '✔ COPIED';
    setTimeout(() => { btnCopyAgain.textContent = '📋 COPY'; }, 1500);
  } else if (lastIngestType === 'signatures' && parsedSignaturesData) {
    const text = formatSignaturesData(parsedSignaturesData, currentFormat);
    await copyOutputToClipboard(text, true);
    btnCopyAgain.textContent = '✔ COPIED';
    setTimeout(() => { btnCopyAgain.textContent = '📋 COPY'; }, 1500);
  } else if (parsedRecords.length > 0) {
    const text = formatTacticalData(parsedRecords, currentFormat);
    await copyOutputToClipboard(text, true);
    btnCopyAgain.textContent = '✔ COPIED';
    setTimeout(() => { btnCopyAgain.textContent = '📋 COPY'; }, 1500);
  } else {
    alert('No telemetry data available to copy yet. Click an ingest button first.');
  }
});

// Format Switchers
for (const [fmt, btn] of Object.entries(fmtButtons)) {
  if (btn) {
    btn.addEventListener('click', async () => {
      setActiveFormat(fmt);
      if (lastIngestType === 'zkill' && parsedZkillData) {
        const text = formatZkillData(parsedZkillData, parsedThreatSynthesis, parsedChainCrossRef, fmt);
        await copyOutputToClipboard(text, true);
        outputBox.innerHTML = `
          <div style="color: #00e5ff; font-weight: 700;">
            [✓] SWITCHED FORMAT: ${fmt.toUpperCase()}
          </div>
          <pre style="font-family: inherit; font-size: 8px; color: #cbd5e1; white-space: pre-wrap; margin: 4px 0 0 0; max-height: 80px; overflow-y: auto;">${text}</pre>
        `;
      } else if (lastIngestType === 'pilots' && parsedPilotsData) {
        const text = formatPilotsData(parsedPilotsData, fmt);
        await copyOutputToClipboard(text, true);
        outputBox.innerHTML = `
          <div style="color: #00e5ff; font-weight: 700;">
            [✓] SWITCHED FORMAT: ${fmt.toUpperCase()}
          </div>
          <pre style="font-family: inherit; font-size: 8px; color: #cbd5e1; white-space: pre-wrap; margin: 4px 0 0 0; max-height: 80px; overflow-y: auto;">${text}</pre>
        `;
      } else if (lastIngestType === 'signatures' && parsedSignaturesData) {
        const text = formatSignaturesData(parsedSignaturesData, fmt);
        await copyOutputToClipboard(text, true);
        outputBox.innerHTML = `
          <div style="color: #00e5ff; font-weight: 700;">
            [✓] SWITCHED FORMAT: ${fmt.toUpperCase()}
          </div>
          <pre style="font-family: inherit; font-size: 8px; color: #cbd5e1; white-space: pre-wrap; margin: 4px 0 0 0; max-height: 80px; overflow-y: auto;">${text}</pre>
        `;
      } else if (parsedRecords.length > 0) {
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

// Attach zKill Action Listeners
if (btnZkillTarget) {
  btnZkillTarget.addEventListener('click', handleIngestZkillTarget);
}
if (btnDiscordFlash) {
  btnDiscordFlash.addEventListener('click', handleCopyDiscordFlash);
}
if (btnTransmitAstrum) {
  btnTransmitAstrum.addEventListener('click', handleTransmitToAstrum);
}

// Open Test Sandboxes
lnkSandbox?.addEventListener('click', (e) => {
  e.preventDefault();
  const sandboxUrl = chrome.runtime.getURL('sandbox/test-map.html');
  chrome.tabs.create({ url: sandboxUrl });
});

lnkZkillSandbox?.addEventListener('click', (e) => {
  e.preventDefault();
  const sandboxUrl = chrome.runtime.getURL('sandbox/test-zkill.html');
  chrome.tabs.create({ url: sandboxUrl });
});

// Settings Drawer Handlers
btnSettings.addEventListener('click', async () => {
  currentSettings = await getSettings();
  txtUrlPatterns.value = (currentSettings.wandererUrlPatterns || []).join('\n');
  txtAstrumApiUrl.value = currentSettings.astrumApiUrl || 'https://astrum.grim-horizon.org/api/intel/tactical-ingest';
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
    astrumApiUrl: txtAstrumApiUrl.value.trim() || 'https://astrum.grim-horizon.org/api/intel/tactical-ingest',
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

