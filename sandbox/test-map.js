// sandbox/test-map.js
import { extractWandererSvgData } from '../content/extractor.js';
import { extractWandererSignatures } from '../content/signatures-extractor.js';
import { validateAndAlignRow, formatTacticalData } from '../lib/ai.js';
import { formatSignaturesData } from '../lib/formatters.js';

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

// Listen for extension popup extraction queries
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_WANDERER_SVG') {
      const data = extractWandererSvgData();
      sendResponse(data);
    } else if (request.action === 'EXTRACT_WANDERER_SIGNATURES') {
      const data = extractWandererSignatures();
      sendResponse(data);
    }
    return true;
  });
}
