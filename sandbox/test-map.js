// sandbox/test-map.js
import { extractWandererSvgData } from '../content/extractor.js';
import { extractWandererSignatures } from '../content/signatures-extractor.js';
import { extractWandererPilots } from '../content/pilots-extractor.js';
import { validateAndAlignRow, formatTacticalData } from '../lib/ai.js';
import { formatSignaturesData, formatPilotsData } from '../lib/formatters.js';

const debugPanel = document.getElementById('debug-panel');
const debugOutput = document.getElementById('debug-output');

const btnRunTest = document.getElementById('btnRunTest');
if (btnRunTest) {
  btnRunTest.addEventListener('click', () => {
    const data = extractWandererSvgData();
    debugPanel.style.display = 'block';
    debugOutput.textContent = JSON.stringify(data, null, 2);
  });
}

const btnToggleFormat = document.getElementById('btnToggleFormat');
if (btnToggleFormat) {
  btnToggleFormat.addEventListener('click', () => {
    const data = extractWandererSvgData();
    const rows = data.clusters.map(c => validateAndAlignRow(c));
    const tsv = formatTacticalData(rows, 'tsv');
    debugPanel.style.display = 'block';
    debugOutput.textContent = tsv;
  });
}

const btnTestSigs = document.getElementById('btnTestSigs');
if (btnTestSigs) {
  btnTestSigs.addEventListener('click', () => {
    const data = extractWandererSignatures();
    const tsv = formatSignaturesData(data, 'tsv');
    debugPanel.style.display = 'block';
    debugOutput.textContent = tsv;
  });
}

const btnTestPilots = document.getElementById('btnTestPilots');
if (btnTestPilots) {
  btnTestPilots.addEventListener('click', async () => {
    const data = await extractWandererPilots();
    const tsv = formatPilotsData(data, 'tsv');
    debugPanel.style.display = 'block';
    debugOutput.textContent = tsv;
  });
}

const btnToggleLocalClear = document.getElementById('btnToggleLocalClear');
if (btnToggleLocalClear) {
  let isClear = false;
  const originalBody = document.querySelector('#mockLocalPanel .panel-body')?.innerHTML;
  btnToggleLocalClear.addEventListener('click', () => {
    isClear = !isClear;
    const titleEl = document.querySelector('#mockLocalPanel .title');
    const bodyEl = document.querySelector('#mockLocalPanel .panel-body');
    if (isClear) {
      if (titleEl) titleEl.textContent = 'Local [0]';
      if (bodyEl) bodyEl.innerHTML = '<div style="padding: 12px; text-align: center; color: #64748b; font-size: 10px;">No pilots active in system.</div>';
      btnToggleLocalClear.textContent = '🔄 RESTORE LOCAL [3]';
    } else {
      if (titleEl) titleEl.textContent = 'Local [3]';
      if (bodyEl) bodyEl.innerHTML = originalBody;
      btnToggleLocalClear.textContent = '🔄 TOGGLE LOCAL CLEAR [0]';
    }
  });
}

// Listen for extension popup extraction queries
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_WANDERER_SVG') {
      const data = extractWandererSvgData();
      sendResponse(data);
    } else if (request.action === 'EXTRACT_WANDERER_SIGNATURES') {
      const data = extractWandererSignatures();
      sendResponse(data);
    } else if (request.action === 'EXTRACT_WANDERER_PILOTS') {
      extractWandererPilots().then(data => sendResponse(data));
      return true;
    }
    return true;
  });
}
