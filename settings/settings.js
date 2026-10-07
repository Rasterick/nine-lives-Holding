// settings/settings.js
import { getSettings, saveSettings } from '../lib/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const txtUrlPatterns = document.getElementById('txtUrlPatterns');
  const txtAstrumApiUrl = document.getElementById('txtAstrumApiUrl');
  const txtAstrumChainGraphUrl = document.getElementById('txtAstrumChainGraphUrl');
  const selFormat = document.getElementById('selFormat');
  const chkAutoCopy = document.getElementById('chkAutoCopy');
  const btnSave = document.getElementById('btnSave');
  const statusMsg = document.getElementById('statusMsg');

  const settings = await getSettings();
  txtUrlPatterns.value = (settings.wandererUrlPatterns || []).join('\n');
  txtAstrumApiUrl.value = settings.astrumApiUrl || 'http://localhost:8000/api/intel/tactical-ingest';
  txtAstrumChainGraphUrl.value = settings.astrumChainGraphUrl || (txtAstrumApiUrl.value ? txtAstrumApiUrl.value.replace(/\/tactical-ingest.*$/i, '/chain-graph/sync') : 'http://localhost:8000/api/intel/chain-graph/sync');
  selFormat.value = settings.defaultFormat || 'tsv';
  chkAutoCopy.checked = !!settings.autoCopy;

  btnSave.addEventListener('click', async () => {
    const patterns = txtUrlPatterns.value
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const ingestUrl = txtAstrumApiUrl.value.trim() || 'http://localhost:8000/api/intel/tactical-ingest';
    const chainGraphUrl = txtAstrumChainGraphUrl.value.trim() || (ingestUrl ? ingestUrl.replace(/\/tactical-ingest.*$/i, '/chain-graph/sync') : 'http://localhost:8000/api/intel/chain-graph/sync');

    const updated = {
      ...settings,
      wandererUrlPatterns: patterns.length > 0 ? patterns : settings.wandererUrlPatterns,
      astrumApiUrl: ingestUrl,
      astrumChainGraphUrl: chainGraphUrl,
      defaultFormat: selFormat.value,
      autoCopy: chkAutoCopy.checked
    };

    await saveSettings(updated);
    statusMsg.style.display = 'block';
    setTimeout(() => { statusMsg.style.display = 'none'; }, 2000);
  });
});
