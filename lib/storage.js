// lib/storage.js
export const DEFAULT_SETTINGS = {
  wandererUrlPatterns: [
    '*://*wanderer*/*',
    'http://localhost:*/*',
    'https://localhost:*/*',
    'http://127.0.0.1:*/*',
    'https://127.0.0.1:*/*'
  ],
  defaultFormat: 'tsv', // 'tsv' | 'json' | 'markdown'
  autoCopy: true,
  includeKspace: true,
  includeNullsec: true
};

export async function getSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    try {
      const res = await chrome.storage.sync.get('settings');
      return { ...DEFAULT_SETTINGS, ...(res.settings || {}) };
    } catch (e) {
      console.warn('Failed to read from chrome.storage.sync, using defaults:', e);
    }
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings) {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    await chrome.storage.sync.set({ settings });
  }
  return settings;
}
