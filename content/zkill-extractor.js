// content/zkill-extractor.js

/**
 * Self-contained tactical extractor for zKillboard and Eve-Kill pages.
 * Designed for execution inside browser tabs via chrome.scripting.executeScript.
 * Contains ALL helper functions internally to guarantee zero ReferenceErrors.
 */
export async function extractZkillData(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) {
    return { success: false, error: 'NO_DOCUMENT_AVAILABLE', data: null };
  }

  try {
    function clean(str) {
      return (str || '').replace(/\s+/g, ' ').trim();
    }

    const currentUrl = (typeof window !== 'undefined' ? window.location.href : '') || doc.location?.href || '';
    const currentPath = (typeof window !== 'undefined' ? window.location.pathname : '') || doc.location?.pathname || '';

    // =========================================================================
    // 1. Identify Entity Type and ID from URL
    // =========================================================================
    let entityType = 'unknown'; // character, corporation, alliance, system, killmail
    let entityId = null;

    const killMatch = currentPath.match(/\/kill\/(\d+)/i) || currentUrl.match(/\/kill\/(\d+)/i);
    const charMatch = currentPath.match(/\/character\/(\d+)/i) || currentUrl.match(/\/character\/(\d+)/i);
    const corpMatch = currentPath.match(/\/corporation\/(\d+)/i) || currentUrl.match(/\/corporation\/(\d+)/i);
    const allianceMatch = currentPath.match(/\/alliance\/(\d+)/i) || currentUrl.match(/\/alliance\/(\d+)/i);
    const systemMatch = currentPath.match(/\/system\/(\d+)/i) || currentUrl.match(/\/system\/(\d+)/i);

    if (killMatch) {
      entityType = 'killmail';
      entityId = parseInt(killMatch[1], 10);
    } else if (charMatch) {
      entityType = 'character';
      entityId = parseInt(charMatch[1], 10);
    } else if (corpMatch) {
      entityType = 'corporation';
      entityId = parseInt(corpMatch[1], 10);
    } else if (allianceMatch) {
      entityType = 'alliance';
      entityId = parseInt(allianceMatch[1], 10);
    } else if (systemMatch) {
      entityType = 'system';
      entityId = parseInt(systemMatch[1], 10);
    }

    // Header extraction
    const pageTitle = clean(doc.title || '');
    let entityName = '';
    const h1 = doc.querySelector('h1') || doc.querySelector('.page-header') || doc.querySelector('.breadcrumb .active');
    if (h1) {
      entityName = clean(h1.textContent);
    }
    if (!entityName && pageTitle) {
      entityName = pageTitle.split('|')[0].split('-')[0].trim();
    }
    // Clean up entity name if it contains pipes
    if (entityName.includes('|')) {
      entityName = entityName.split('|')[0].trim();
    }

    // Try extracting corp/alliance affiliation if available on profile pages
    let entityCorp = '';
    let entityCorpId = null;
    let entityAlliance = '';
    let entityAllianceId = null;

    if (entityType === 'system') {
      entityCorp = 'Solar System (J-Space)';
    } else {
      const corpLink = doc.querySelector('a[href*="/corporation/"]');
      if (corpLink) {
        entityCorp = clean(corpLink.textContent);
        const m = corpLink.getAttribute('href')?.match(/\/corporation\/(\d+)/i);
        if (m) entityCorpId = parseInt(m[1], 10);
      }

      const allianceLink = doc.querySelector('a[href*="/alliance/"]');
      if (allianceLink) {
        entityAlliance = clean(allianceLink.textContent);
        const m = allianceLink.getAttribute('href')?.match(/\/alliance\/(\d+)/i);
        if (m) entityAllianceId = parseInt(m[1], 10);
      }
    }

    // Helper: Parse timestamps from table row or element
    function parseTimestamp(el) {
      if (!el) return { timeUtc: '', epochMs: 0, timeAgo: '' };
      // 1. Check data-timestamp or datetime attributes
      const rawAttr = el.getAttribute?.('data-timestamp') || el.getAttribute?.('datetime') || el.getAttribute?.('title');
      if (rawAttr) {
        const parsed = Date.parse(rawAttr);
        if (!isNaN(parsed)) {
          const deltaMin = Math.round((Date.now() - parsed) / 60000);
          let timeAgo = deltaMin < 60 ? `${deltaMin}m ago` : `${Math.round(deltaMin / 60)}h ago`;
          return { timeUtc: new Date(parsed).toISOString(), epochMs: parsed, timeAgo };
        }
      }
      // 2. Check inner text
      const txt = clean(el.textContent);
      const isoMatch = txt.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/);
      if (isoMatch) {
        const parsed = Date.parse(isoMatch[1].replace(' ', 'T') + 'Z');
        if (!isNaN(parsed)) {
          const deltaMin = Math.round((Date.now() - parsed) / 60000);
          let timeAgo = deltaMin < 60 ? `${deltaMin}m ago` : `${Math.round(deltaMin / 60)}h ago`;
          return { timeUtc: new Date(parsed).toISOString(), epochMs: parsed, timeAgo };
        }
      }
      return { timeUtc: '', epochMs: 0, timeAgo: txt };
    }

    // =========================================================================
    // 2. CASE A: SINGLE KILLMAIL PAGE (/kill/:id/)
    // =========================================================================
    if (entityType === 'killmail') {
      let victim = {
        name: '',
        characterId: null,
        corp: '',
        corpId: null,
        alliance: '',
        allianceId: null,
        ship: '',
        shipId: null,
        damageTaken: 0
      };

      // Extract victim block
      const victimBlock = doc.querySelector('.victim') || doc.querySelector('[class*="victim"]') || doc.querySelector('table');
      if (victimBlock) {
        const vChar = victimBlock.querySelector('a[href*="/character/"]');
        if (vChar) {
          victim.name = clean(vChar.textContent);
          const m = vChar.getAttribute('href')?.match(/\/character\/(\d+)/i);
          if (m) victim.characterId = parseInt(m[1], 10);
        }
        const vCorp = victimBlock.querySelector('a[href*="/corporation/"]');
        if (vCorp) {
          victim.corp = clean(vCorp.textContent);
          const m = vCorp.getAttribute('href')?.match(/\/corporation\/(\d+)/i);
          if (m) victim.corpId = parseInt(m[1], 10);
        }
        const vAlliance = victimBlock.querySelector('a[href*="/alliance/"]');
        if (vAlliance) {
          victim.alliance = clean(vAlliance.textContent);
          const m = vAlliance.getAttribute('href')?.match(/\/alliance\/(\d+)/i);
          if (m) victim.allianceId = parseInt(m[1], 10);
        }
        const vShip = victimBlock.querySelector('a[href*="/ship/"]') || victimBlock.querySelector('img[src*="/types/"]');
        if (vShip) {
          victim.ship = clean(vShip.textContent || vShip.getAttribute('alt') || vShip.getAttribute('title'));
          const m = (vShip.getAttribute('href') || vShip.getAttribute('src'))?.match(/\/(?:ship|types)\/(\d+)/i);
          if (m) victim.shipId = parseInt(m[1], 10);
        }
      }

      // Extract system & timestamp from killmail metadata
      let solarSystem = '';
      let solarSystemId = null;
      let timestamp = { timeUtc: '', epochMs: 0, timeAgo: '' };

      const sysLink = doc.querySelector('a[href*="/system/"]');
      if (sysLink) {
        solarSystem = clean(sysLink.textContent);
        const m = sysLink.getAttribute('href')?.match(/\/system\/(\d+)/i);
        if (m) solarSystemId = parseInt(m[1], 10);
      }

      const timeEl = doc.querySelector('[datetime]') || doc.querySelector('[data-timestamp]') || doc.querySelector('.time') || doc.querySelector('.killmail-time');
      timestamp = parseTimestamp(timeEl);

      // Extract all attackers (Gang Composition)
      const attackers = [];
      const attackerRows = doc.querySelectorAll('.killmail-attackers tr, .attacker, [class*="attacker"]');

      attackerRows.forEach((row) => {
        const charA = row.querySelector('a[href*="/character/"]');
        if (!charA && !row.querySelector('img[src*="/characters/"]')) return;

        const pilotName = clean(charA ? charA.textContent : (row.querySelector('img[src*="/characters/"]')?.getAttribute('alt') || 'Unknown Pilot'));
        let charId = null;
        const charHref = charA?.getAttribute('href') || row.querySelector('img[src*="/characters/"]')?.getAttribute('src') || '';
        const mChar = charHref.match(/\/character[s]?\/(\d+)/i);
        if (mChar) charId = parseInt(mChar[1], 10);

        let corpName = '';
        let corpId = null;
        const corpA = row.querySelector('a[href*="/corporation/"]');
        if (corpA) {
          corpName = clean(corpA.textContent);
          const mCorp = corpA.getAttribute('href')?.match(/\/corporation\/(\d+)/i);
          if (mCorp) corpId = parseInt(mCorp[1], 10);
        }

        let allianceName = '';
        let allianceId = null;
        const allA = row.querySelector('a[href*="/alliance/"]');
        if (allA) {
          allianceName = clean(allA.textContent);
          const mAll = allA.getAttribute('href')?.match(/\/alliance\/(\d+)/i);
          if (mAll) allianceId = parseInt(mAll[1], 10);
        }

        let shipName = '';
        let shipId = null;
        const shipA = row.querySelector('a[href*="/ship/"]') || row.querySelector('img[src*="/types/"]');
        if (shipA) {
          shipName = clean(shipA.textContent || shipA.getAttribute('alt') || shipA.getAttribute('title'));
          const mShip = (shipA.getAttribute('href') || shipA.getAttribute('src'))?.match(/\/(?:ship|types)\/(\d+)/i);
          if (mShip) shipId = parseInt(mShip[1], 10);
        }

        let weaponName = '';
        let weaponId = null;
        const weaponImg = row.querySelector('img[src*="/types/"]:not([src*="' + shipId + '"])') || row.querySelectorAll('img[src*="/types/"]')[1];
        if (weaponImg) {
          weaponName = clean(weaponImg.getAttribute('alt') || weaponImg.getAttribute('title'));
          const mW = weaponImg.getAttribute('src')?.match(/\/types\/(\d+)/i);
          if (mW) weaponId = parseInt(mW[1], 10);
        }

        const isFinalBlow = /final blow/i.test(row.textContent) || !!row.querySelector('.fa-crosshairs, .final-blow, img[src*="blow"]');

        attackers.push({
          pilotName,
          characterId: charId,
          corpName,
          corpId,
          allianceName,
          allianceId,
          shipName,
          shipId,
          weaponName,
          weaponId,
          finalBlow: isFinalBlow
        });
      });

      return {
        success: true,
        entityType: 'killmail',
        entityId,
        pageUrl: currentUrl,
        extractedAt: new Date().toISOString(),
        victim,
        solarSystem,
        solarSystemId,
        timestamp,
        gangCount: attackers.length,
        attackers,
        uniqueSystems: solarSystem ? [solarSystem] : [],
        shipsObserved: [...new Set(attackers.map(a => a.shipName).filter(Boolean))]
      };
    }

    // =========================================================================
    // 3. CASE B: ENTITY KILLBOARD (Character, Corp, Alliance, or System)
    // =========================================================================
    const candidateRows = Array.from(doc.querySelectorAll('tr, .killlist-row, .row')).filter(r => {
      return r.querySelector('a[href*="/kill/"]') !== null;
    });

    const parsedKills = [];
    const now = Date.now();
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

    for (const row of candidateRows) {
      const killLink = row.querySelector('a[href*="/kill/"]');
      if (!killLink) continue;

      const killHref = killLink.getAttribute('href') || '';
      const mKill = killHref.match(/\/kill\/(\d+)/i);
      const killId = mKill ? parseInt(mKill[1], 10) : null;

      // System
      let systemName = '';
      let systemId = null;
      const sysLink = row.querySelector('a[href*="/system/"]');
      if (sysLink) {
        systemName = clean(sysLink.textContent);
        const m = sysLink.getAttribute('href')?.match(/\/system\/(\d+)/i);
        if (m) systemId = parseInt(m[1], 10);
      }
      if ((!systemName || /^\d+$/.test(systemName)) && entityType === 'system') {
        systemName = entityName;
        systemId = entityId;
      }

      // Ship
      let shipName = '';
      let shipId = null;
      const shipLink = row.querySelector('a[href*="/ship/"]') || row.querySelector('img[src*="/types/"]');
      if (shipLink) {
        shipName = clean(shipLink.textContent || shipLink.getAttribute('alt') || shipLink.getAttribute('title'));
        const m = (shipLink.getAttribute('href') || shipLink.getAttribute('src'))?.match(/\/(?:ship|types)\/(\d+)/i);
        if (m) shipId = parseInt(m[1], 10);
      }

      // Time
      const timeEl = row.querySelector('[datetime]') || row.querySelector('[data-timestamp]') || row.querySelector('.text-muted') || row.querySelector('td:last-child');
      const timeInfo = parseTimestamp(timeEl);

      // Kill vs Loss detection
      const rowClass = (row.className || '').toLowerCase();
      const isLoss = rowClass.includes('danger') || rowClass.includes('loss') || !!row.querySelector('.loss, .text-danger');

      // Pilot / Target on this row
      const charLink = row.querySelector('a[href*="/character/"]');
      const targetPilot = clean(charLink?.textContent || '');

      parsedKills.push({
        killId,
        solarSystem: systemName,
        solarSystemId: systemId,
        shipName,
        shipId,
        timestamp: timeInfo,
        isLoss,
        targetPilot
      });
    }

    // Apply the "Smart Dual-Cap" (12h window + min 10 baseline, max 20 ceiling)
    const recentKillsWithin12h = parsedKills.filter(k => {
      if (!k.timestamp.epochMs) return false;
      return (now - k.timestamp.epochMs) <= TWELVE_HOURS_MS;
    });

    let selectedKills = [];
    let filterReason = '';

    if (recentKillsWithin12h.length >= 10) {
      selectedKills = recentKillsWithin12h.slice(0, 20);
      filterReason = `Active 12h Window (${selectedKills.length} events)`;
    } else {
      selectedKills = parsedKills.slice(0, 10);
      filterReason = `Historical Baseline (${selectedKills.length} events)`;
    }

    // Aggregate summary statistics
    const uniqueSystems = [...new Set(selectedKills.map(k => k.solarSystem).filter(Boolean))];
    const shipsObserved = [...new Set(selectedKills.map(k => k.shipName).filter(Boolean))];
    const killsCount = selectedKills.filter(k => !k.isLoss).length;
    const lossesCount = selectedKills.filter(k => k.isLoss).length;

    return {
      success: true,
      entityType,
      entityId,
      entityName,
      entityCorp,
      entityCorpId,
      entityAlliance,
      entityAllianceId,
      pageUrl: currentUrl,
      extractedAt: new Date().toISOString(),
      filterReason,
      totalOnPage: parsedKills.length,
      sampleCount: selectedKills.length,
      killsCount,
      lossesCount,
      uniqueSystems,
      shipsObserved,
      recentEvents: selectedKills,
      latestSystem: selectedKills[0]?.solarSystem || '',
      latestTimeAgo: selectedKills[0]?.timestamp?.timeAgo || 'Unknown'
    };

  } catch (err) {
    return {
      success: false,
      error: err.message || 'EXTRACTION_EXCEPTION',
      debug: { stack: err.stack }
    };
  }
}
