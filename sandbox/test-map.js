// sandbox/test-map.js
import { extractWandererSvgData } from '../content/extractor.js';
import { validateAndAlignRow, formatTacticalData } from '../lib/ai.js';

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

// Listen for extension popup extraction queries
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_WANDERER_SVG') {
      const data = extractWandererSvgData();
      sendResponse(data);
    }
    return true;
  });
}
