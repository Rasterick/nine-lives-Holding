// content/evetools-extractor.js

/**
 * Tactical extractor and floating action pill for br.evetools.org battle reports.
 * Injects an [ ⚡ INGEST TO ASTRUM INTEL ] button directly into EveTools.
 */

function extractEveToolsBattleReport(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) {
    return { success: false, error: 'NO_DOCUMENT_AVAILABLE', data: null };
  }

  try {
    const url = (typeof window !== 'undefined' ? window.location.href : '') || doc.location?.href || '';
    const path = (typeof window !== 'undefined' ? window.location.pathname : '') || doc.location?.pathname || '';

    // Match br_id
    const brMatch = path.match(/\/br\/([a-zA-Z0-9_-]+)/) || url.match(/\/br\/([a-zA-Z0-9_-]+)/);
    if (!brMatch) {
      return { success: false, error: 'NOT_A_BATTLE_REPORT', data: null };
    }
    const brId = brMatch[1];

    // Extract Solar System
    let systemName = 'Unknown';
    const systemEl = doc.querySelector('a[href*="dotlan.net"], a[href*="evemaps"], .system-name, [class*="system"]');
    if (systemEl) {
      systemName = systemEl.textContent.trim().split(' ')[0];
    }

    // Extract all unique killmail IDs from anchors matching /kill/\d+
    const killmailIds = new Set();
    const killAnchors = doc.querySelectorAll('a[href*="/kill/"]');
    killAnchors.forEach(a => {
      const match = a.href.match(/\/kill\/(\d+)/);
      if (match) {
        killmailIds.add(parseInt(match[1], 10));
      }
    });

    // Also scan all links for kb.evetools.org or zkillboard
    const allLinks = doc.querySelectorAll('a');
    allLinks.forEach(a => {
      const m = a.href.match(/kill\/(\d+)/i);
      if (m) killmailIds.add(parseInt(m[1], 10));
    });

    // Team extraction
    const teams = {
      team_a: { name: 'Team A', pilots: [] },
      team_b: { name: 'Team B', pilots: [] }
    };

    // Parse team tables/containers
    const teamContainers = doc.querySelectorAll('.team, [class*="team-"], .team-col, .col');
    if (teamContainers.length >= 2) {
      // First column is Team A, second is Team B
      const parsePilots = (container) => {
        const list = [];
        const rows = container.querySelectorAll('.pilot, .row, [class*="pilot"]');
        rows.forEach(r => {
          const nameEl = r.querySelector('a, .name, [class*="name"]');
          const shipEl = r.querySelector('.ship, [class*="ship"]');
          if (nameEl) {
            list.push({
              name: nameEl.textContent.trim(),
              ship: shipEl ? shipEl.textContent.trim() : 'Unknown'
            });
          }
        });
        return list;
      };

      teams.team_a.pilots = parsePilots(teamContainers[0]);
      teams.team_b.pilots = parsePilots(teamContainers[1]);
    }

    return {
      success: true,
      data: {
        br_id: brId,
        source_url: url,
        solar_system_name: systemName,
        killmail_ids: Array.from(killmailIds),
        total_kills: killmailIds.size,
        teams: teams
      }
    };
  } catch (err) {
    return { success: false, error: err.message, data: null };
  }
}

/**
 * Injects a floating tactical action pill on br.evetools.org
 */
function injectEveToolsPill(targetApiUrl = null) {
  if (typeof document === 'undefined') return;
  if (document.getElementById('nine-lives-br-pill')) return;

  const pill = document.createElement('div');
  pill.id = 'nine-lives-br-pill';
  pill.style.cssText = `
    position: fixed;
    top: 12px;
    right: 140px;
    z-index: 999999;
    display: flex;
    align-items: center;
    gap: 8px;
    background: #030712;
    border: 1px solid #00f0ff;
    padding: 6px 14px;
    border-radius: 4px;
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
    font-family: monospace;
    font-size: 11px;
    font-weight: bold;
    color: #00f0ff;
    cursor: pointer;
    transition: all 0.2s ease;
  `;

  pill.innerHTML = `
    <span style="font-size: 13px;">⚡</span>
    <span>INGEST TO ASTRUM INTEL</span>
  `;

  pill.addEventListener('mouseenter', () => {
    pill.style.background = '#08172c';
    pill.style.boxShadow = '0 0 20px rgba(0, 240, 255, 0.7)';
  });

  pill.addEventListener('mouseleave', () => {
    pill.style.background = '#030712';
    pill.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.4)';
  });

  pill.addEventListener('click', async () => {
    pill.innerHTML = `<span>⏳</span><span>INGESTING...</span>`;
    pill.style.borderColor = '#f59e0b';
    pill.style.color = '#f59e0b';

    const extract = extractEveToolsBattleReport(document);
    if (!extract.success || !extract.data.killmail_ids.length) {
      pill.innerHTML = `<span>⚠️</span><span>NO KILLS DETECTED</span>`;
      setTimeout(() => {
        pill.innerHTML = `<span>⚡</span><span>INGEST TO ASTRUM INTEL</span>`;
        pill.style.borderColor = '#00f0ff';
        pill.style.color = '#00f0ff';
      }, 3000);
      return;
    }

    const candidateUrls = [
      targetApiUrl,
      'http://localhost:8000/api/battles/ingest',
      'http://localhost/astrum-intel/public/api/battles/ingest',
      'http://localhost/api/battles/ingest'
    ].filter(Boolean);

    let succeeded = false;
    let lastError = 'API OFFLINE';

    for (const url of candidateUrls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(extract.data)
        });

        const resJson = await response.json();
        if (resJson.success) {
          pill.innerHTML = `<span>✔</span><span>SYNCED (${resJson.kills_matched} KILLS)</span>`;
          pill.style.borderColor = '#10b981';
          pill.style.color = '#10b981';
          succeeded = true;
          break;
        } else {
          lastError = resJson.message || 'INGEST FAILED';
        }
      } catch (err) {
        // Continue to next candidate URL
      }
    }

    if (!succeeded) {
      pill.innerHTML = `<span>⚠️</span><span>${lastError}</span>`;
      pill.style.borderColor = '#ef4444';
      pill.style.color = '#ef4444';
    }

    setTimeout(() => {
      pill.innerHTML = `<span>⚡</span><span>INGEST TO ASTRUM INTEL</span>`;
      pill.style.borderColor = '#00f0ff';
      pill.style.color = '#00f0ff';
    }, 4000);
  });

  document.body.appendChild(pill);
}

// Auto-run if loaded directly in tab on br.evetools.org
if (typeof window !== 'undefined' && window.location.hostname.includes('evetools.org')) {
  setTimeout(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['astrumApiUrl'], (res) => {
        let apiUrl = null;
        if (res && res.astrumApiUrl) {
          apiUrl = res.astrumApiUrl.replace(/\/intel\/tactical-ingest.*$/i, '/battles/ingest');
        }
        injectEveToolsPill(apiUrl);
      });
    } else {
      injectEveToolsPill();
    }
  }, 1000);
}

