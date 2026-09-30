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

      // 1. Extract victim metadata from meta tags, title, and DOM
      const metaDesc = doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ||
                       doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      const metaMatch = metaDesc.match(/^(.+?)\s*\((.+?)\)\s*lost their\s*(.+?)\s*in\s*([A-Za-z0-9-]+)/i);
      if (metaMatch) {
        victim.name = clean(metaMatch[1]);
        victim.corp = clean(metaMatch[2]);
        victim.ship = clean(metaMatch[3]);
        if (!solarSystem) solarSystem = clean(metaMatch[4]);
      }

      // Title fallback
      if ((!victim.name || !victim.ship) && pageTitle.includes('|')) {
        const titleParts = pageTitle.split('|').map(p => clean(p));
        if (titleParts.length >= 2) {
          if (!victim.ship) victim.ship = titleParts[0];
          if (!victim.name) victim.name = titleParts[1];
        }
      }

      // DOM search across tables for victim identifiers & IDs
      const allTables = Array.from(doc.querySelectorAll('table'));
      for (const table of allTables) {
        // Victim character
        const charLinks = Array.from(table.querySelectorAll('a[href*="/character/"]'));
        const charText = charLinks.find(a => clean(a.textContent).length > 0);
        if (charText && !victim.name) {
          victim.name = clean(charText.textContent);
          const m = charText.getAttribute('href')?.match(/\/character\/(\d+)/i);
          if (m) victim.characterId = parseInt(m[1], 10);
        } else if (charLinks[0] && !victim.characterId) {
          const m = charLinks[0].getAttribute('href')?.match(/\/character\/(\d+)/i);
          if (m) victim.characterId = parseInt(m[1], 10);
        }

        // Victim corp
        const corpLinks = Array.from(table.querySelectorAll('a[href*="/corporation/"]'));
        const corpText = corpLinks.find(a => clean(a.textContent).length > 0);
        if (corpText && !victim.corp) {
          victim.corp = clean(corpText.textContent);
          const m = corpText.getAttribute('href')?.match(/\/corporation\/(\d+)/i);
          if (m) victim.corpId = parseInt(m[1], 10);
        } else if (corpLinks[0] && !victim.corpId) {
          const m = corpLinks[0].getAttribute('href')?.match(/\/corporation\/(\d+)/i);
          if (m) victim.corpId = parseInt(m[1], 10);
        }

        // Victim alliance
        const alliLinks = Array.from(table.querySelectorAll('a[href*="/alliance/"]'));
        const alliText = alliLinks.find(a => clean(a.textContent).length > 0);
        if (alliText && !victim.alliance) {
          victim.alliance = clean(alliText.textContent);
          const m = alliText.getAttribute('href')?.match(/\/alliance\/(\d+)/i);
          if (m) victim.allianceId = parseInt(m[1], 10);
        } else if (alliLinks[0] && !victim.allianceId) {
          const m = alliLinks[0].getAttribute('href')?.match(/\/alliance\/(\d+)/i);
          if (m) victim.allianceId = parseInt(m[1], 10);
        }

        // Victim ship & system from info table
        const shipCell = Array.from(table.querySelectorAll('td, th')).find(c => /Ship:/i.test(c.textContent));
        if (shipCell) {
          const sRow = shipCell.closest('tr') || shipCell.parentElement;
          const sLink = sRow?.querySelector('a[href*="/ship/"]');
          if (sLink) {
            victim.ship = clean(sLink.textContent);
            const m = sLink.getAttribute('href')?.match(/\/ship\/(\d+)/i);
            if (m) victim.shipId = parseInt(m[1], 10);
          }
        }

        const sysCell = Array.from(table.querySelectorAll('td, th')).find(c => /System:/i.test(c.textContent));
        if (sysCell) {
          const sRow = sysCell.closest('tr') || sysCell.parentElement;
          const sLink = sRow?.querySelector('a[href*="/system/"]');
          if (sLink && !solarSystem) {
            solarSystem = clean(sLink.textContent).split('(')[0].trim();
            const m = sLink.getAttribute('href')?.match(/\/system\/(\d+)/i);
            if (m) solarSystemId = parseInt(m[1], 10);
          }
        }

        if (victim.name && victim.ship && victim.characterId) break;
      }

      // Extract system & timestamp fallback
      if (!solarSystem) {
        const sysLink = doc.querySelector('a[href*="/system/"]');
        if (sysLink) {
          solarSystem = clean(sysLink.textContent).split('(')[0].trim();
          const m = sysLink.getAttribute('href')?.match(/\/system\/(\d+)/i);
          if (m) solarSystemId = parseInt(m[1], 10);
        }
      }

      const timeEl = doc.querySelector('.info_kill_dttm') || doc.querySelector('[datetime]') || doc.querySelector('[data-timestamp]') || doc.querySelector('.time') || doc.querySelector('.killmail-time');
      timestamp = parseTimestamp(timeEl);

      // =======================================================================
      // 2. Extract all attackers (Gang Composition) - zKillboard & Eve-Kill
      // =======================================================================
      const attackers = [];

      // Find candidate rows for attackers
      let attackerRows = Array.from(doc.querySelectorAll('.killmail-attackers tr, tr.attacker, [class*="attacker"]'));

      // If class-based search found 0 or only 1 row (Eve-Kill or alternate templates), inspect tables
      if (attackerRows.length <= 1) {
        const candidateTables = Array.from(doc.querySelectorAll('table')).filter(tbl => {
          const txt = (tbl.textContent || '').toLowerCase();
          return (txt.includes('involved') || txt.includes('damage') || txt.includes('attacker') || tbl.id === 'attackers') &&
                 !tbl.querySelector('textarea#eft');
        });

        for (const tbl of candidateTables) {
          const rows = Array.from(tbl.querySelectorAll('tbody tr, tr')).filter(r => {
            const hasLinks = r.querySelector('a[href*="/character/"], a[href*="/ship/"], a[href*="/item/"], a[href*="/types/"], img[src*="/types/"], img[src*="/characters/"]');
            const isHeader = r.querySelector('th') || r.classList.contains('titles');
            return hasLinks && !isHeader;
          });
          if (rows.length > attackerRows.length) {
            attackerRows = rows;
          }
        }
      }

      // Filter out summary/header rows (e.g. Final Blow / Top Damage boxes)
      attackerRows = attackerRows.filter(r => !r.closest('.titles') && !r.classList.contains('titles') && !r.querySelector('th'));

      attackerRows.forEach((row) => {
        // Pilot Name & Character ID
        let pilotName = '';
        let charId = null;

        const charLinks = Array.from(row.querySelectorAll('a[href*="/character/"]'));
        const charWithText = charLinks.find(a => clean(a.textContent).length > 0);
        if (charWithText) {
          pilotName = clean(charWithText.textContent);
          const m = charWithText.getAttribute('href')?.match(/\/character\/(\d+)/i);
          if (m) charId = parseInt(m[1], 10);
        } else if (charLinks[0]) {
          const m = charLinks[0].getAttribute('href')?.match(/\/character\/(\d+)/i);
          if (m) charId = parseInt(m[1], 10);
          const t = charLinks[0].getAttribute('title') || charLinks[0].getAttribute('data-bs-original-title') || charLinks[0].getAttribute('data-original-title');
          if (t) pilotName = clean(t);
        }

        // If NPC attacker (e.g. Awakened Preserver, Sleeper, Diamond NPC)
        if (!pilotName || pilotName.toLowerCase().includes('unknown character')) {
          const npcLink = row.querySelector('.pilotinfo a[href*="/ship/"], .pilotinfo a, a[href*="/ship/"], a[href*="/item/"]');
          const npcText = clean(npcLink?.textContent || '');
          if (npcText) {
            pilotName = npcText;
          } else {
            const imgAlt = row.querySelector('img.shipImageRender, img[src*="/types/"]')?.getAttribute('alt');
            if (imgAlt) pilotName = clean(imgAlt);
          }
        }
        if (!pilotName) pilotName = 'Unknown Attacker';

        // Corp
        let corpName = '';
        let corpId = null;
        const corpLinks = Array.from(row.querySelectorAll('a[href*="/corporation/"]'));
        const corpWithText = corpLinks.find(a => clean(a.textContent).length > 0);
        if (corpWithText) {
          corpName = clean(corpWithText.textContent);
          const m = corpWithText.getAttribute('href')?.match(/\/corporation\/(\d+)/i);
          if (m) corpId = parseInt(m[1], 10);
        } else if (corpLinks[0]) {
          const m = corpLinks[0].getAttribute('href')?.match(/\/corporation\/(\d+)/i);
          if (m) corpId = parseInt(m[1], 10);
          const t = corpLinks[0].getAttribute('title') || corpLinks[0].getAttribute('data-bs-original-title');
          if (t) corpName = clean(t);
        }

        // Alliance
        let allianceName = '';
        let allianceId = null;
        const allLinks = Array.from(row.querySelectorAll('a[href*="/alliance/"]'));
        const allWithText = allLinks.find(a => clean(a.textContent).length > 0);
        if (allWithText) {
          allianceName = clean(allWithText.textContent);
          const m = allWithText.getAttribute('href')?.match(/\/alliance\/(\d+)/i);
          if (m) allianceId = parseInt(m[1], 10);
        } else if (allLinks[0]) {
          const m = allLinks[0].getAttribute('href')?.match(/\/alliance\/(\d+)/i);
          if (m) allianceId = parseInt(m[1], 10);
          const t = allLinks[0].getAttribute('title') || allLinks[0].getAttribute('data-bs-original-title');
          if (t) allianceName = clean(t);
        }

        // Ship
        let shipName = '';
        let shipId = null;

        const shipA = row.querySelector('a[href*="/ship/"]');
        const shipImg = row.querySelector('img.shipImageRender, a[href*="/ship/"] img, img[src*="/types/"]');

        if (shipA) {
          const m = shipA.getAttribute('href')?.match(/\/ship\/(\d+)/i);
          if (m) shipId = parseInt(m[1], 10);
          if (clean(shipA.textContent).length > 0) {
            shipName = clean(shipA.textContent);
          } else {
            const t = shipA.getAttribute('title') || shipA.getAttribute('data-bs-original-title') || shipA.getAttribute('data-original-title');
            if (t) shipName = clean(t);
          }
        }

        if (!shipName && shipImg) {
          const alt = shipImg.getAttribute('alt') || shipImg.getAttribute('title');
          if (alt) shipName = clean(alt);
          if (!shipId) {
            const m = shipImg.getAttribute('src')?.match(/\/types\/(\d+)/i);
            if (m) shipId = parseInt(m[1], 10);
          }
        }

        if (!shipName && pilotName && !charId) {
          shipName = pilotName; // e.g. Awakened Preserver
        }

        // Weapon
        let weaponName = '';
        let weaponId = null;

        const itemA = row.querySelector('a[href*="/item/"], a[href*="/type/"]');
        if (itemA) {
          const m = itemA.getAttribute('href')?.match(/\/(?:item|type)\/(\d+)/i);
          if (m) weaponId = parseInt(m[1], 10);
          const t = itemA.getAttribute('title') || itemA.getAttribute('data-bs-original-title') || itemA.getAttribute('data-original-title') || itemA.textContent;
          if (t) weaponName = clean(t);
        }

        if (!weaponName) {
          const weaponImg = row.querySelector('img[src*="/types/"]:not([src*="' + shipId + '"])') ||
                            row.querySelectorAll('img[src*="/types/"]')[1];
          if (weaponImg) {
            weaponName = clean(weaponImg.getAttribute('alt') || weaponImg.getAttribute('title') || '');
            const m = weaponImg.getAttribute('src')?.match(/\/types\/(\d+)/i);
            if (m) weaponId = parseInt(m[1], 10);
          }
        }

        const isFinalBlow = /final blow/i.test(row.textContent) ||
                            !!row.querySelector('.fa-crosshairs, .final-blow, .info_final_blow, img[src*="blow"]');

        const FRIENDLY_CORPS = [
          'nine lives privateering company',
          'alterior horizons',
          'fishworks oil exploration and cattle',
          'ulteria horizons'
        ];
        const FRIENDLY_CORP_IDS = [98725353];
        const isFriendly = (
          (corpName && FRIENDLY_CORPS.some(fc => corpName.toLowerCase().includes(fc))) ||
          (corpId && FRIENDLY_CORP_IDS.includes(Number(corpId)))
        );

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
          finalBlow: isFinalBlow,
          isFriendly
        });
      });

      const FRIENDLY_CORPS = [
        'nine lives privateering company',
        'alterior horizons',
        'fishworks oil exploration and cattle',
        'ulteria horizons'
      ];
      const FRIENDLY_CORP_IDS = [98725353];
      victim.isFriendly = (
        (victim.corp && FRIENDLY_CORPS.some(fc => victim.corp.toLowerCase().includes(fc))) ||
        (victim.corpId && FRIENDLY_CORP_IDS.includes(Number(victim.corpId)))
      );

      const isEveKill = currentUrl.includes('eve-kill') || currentUrl.includes('evekill');
      const source = isEveKill ? 'eve-kill' : 'zkillboard';

      // Set top-level entity properties from victim
      const entityName = victim.name ? (victim.ship ? `${victim.name}'s ${victim.ship}` : victim.name) : (victim.ship || 'Target Ship');
      const entityCorp = victim.corp || '';
      const entityCorpId = victim.corpId || null;
      const entityAlliance = victim.alliance || '';
      const entityAllianceId = victim.allianceId || null;
      const finalEntityId = victim.characterId || entityId;

      return {
        success: true,
        source,
        entityType: 'killmail',
        entityId: finalEntityId,
        entityName,
        entityCorp,
        entityCorpId,
        entityAlliance,
        entityAllianceId,
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

    const isEveKill = currentUrl.includes('eve-kill') || currentUrl.includes('evekill');
    const source = isEveKill ? 'eve-kill' : 'zkillboard';

    return {
      success: true,
      source,
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
