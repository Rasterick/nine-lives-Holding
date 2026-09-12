// settings/settings.js
import { getSettings, saveSettings } from '../lib/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const txtUrlPatterns = document.getElementById('txtUrlPatterns');
  const selFormat = document.getElementById('selFormat');
  const chkAutoCopy = document.getElementById('chkAutoCopy');
  const btnSave = document.getElementById('btnSave');
  const statusMsg = document.getElementById('statusMsg');

  const settings = await getSettings();
  txtUrlPatterns.value = (settings.wandererUrlPatterns || []).join('\n');
  selFormat.value = settings.defaultFormat || 'tsv';
  chkAutoCopy.checked = !!settings.autoCopy;

  btnSave.addEventListener('click', async () => {
    const patterns = txtUrlPatterns.value
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const updated = {
      ...settings,
      wandererUrlPatterns: patterns.length > 0 ? patterns : settings.wandererUrlPatterns,
      defaultFormat: selFormat.value,
      autoCopy: chkAutoCopy.checked
    };

    await saveSettings(updated);
    statusMsg.style.display = 'block';
    setTimeout(() => { statusMsg.style.display = 'none'; }, 2000);
  });
});
