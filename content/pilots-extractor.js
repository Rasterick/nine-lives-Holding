// content/pilots-extractor.js

/**
 * Self-contained tactical extractor for Wanderer Local System Pilots roster.
 * Designed for execution inside browser tabs via chrome.scripting.executeScript.
 * Contains ALL helper functions internally to guarantee zero ReferenceErrors.
 */
export function extractWandererPilots(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) {
    return { success: false, error: 'NO_DOCUMENT_AVAILABLE', pilots: [] };
  }

  try {
    function clean(str) {
      return (str || '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Walks DOM node tree and extracts text pieces joined by spaces.
     */
    function extractCleanNodeText(el) {
      if (!el) return '';
      const pieces = [];
      function walk(n) {
        if (!n) return;
        if (n.nodeType === 3) {
          const val = (n.nodeValue || '').trim();
          if (val) pieces.push(val);
        } else {
          if (n.tagName && (/^(svg|button)$/i.test(n.tagName) || (n.classList?.contains && n.classList.contains('icon')))) return;
          if (n.childNodes) {
            for (const child of n.childNodes) {
              walk(child);
            }
          }
        }
      }
      walk(el);
      const txt = pieces.join(' ').replace(/\s+/g, ' ').trim();
      return txt || (el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    // Search roots: main document and any accessible iframes
    const searchRoots = [doc];
    const iframes = Array.from(doc.querySelectorAll?.('iframe') || []);
    for (const f of iframes) {
      try {
        if (f.contentDocument) searchRoots.push(f.contentDocument);
      } catch {}
    }

    let detectedSystem = 'Unknown';
    let detectedClass = 'Unknown';
    let matchedHeaderEl = null;
    let localCount = null;

    // --- PHASE 1: Resolve Active System and Wormhole Class ---
    // Priority 1: Check Signatures panel if open on the same page
    for (const root of searchRoots) {
      const allEls = Array.from(root.querySelectorAll('*'));
      for (const el of allEls) {
        if (/Signatures\s*in/i.test(el.textContent)) {
          const txt = extractCleanNodeText(el);
          if (txt.length < 200) {
            const match = txt.match(/(?:Signatures\s*)?in\s*(C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\s*(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})/i);
            if (match) {
              detectedClass = match[1].toUpperCase();
              detectedSystem = match[2].toUpperCase();
              break;
            }
          }
        }
      }
      if (detectedSystem !== 'Unknown') break;
    }

    // Priority 2: Check active/selected node in SVG canvas
    if (detectedSystem === 'Unknown') {
      for (const root of searchRoots) {
        const activeNode = root.querySelector?.('.system-node.active, g.active, [aria-selected="true"]');
        if (activeNode) {
          const nodeText = extractCleanNodeText(activeNode);
          const jMatch = nodeText.match(/\b(J\d{6})\b/i);
          if (jMatch) detectedSystem = jMatch[1].toUpperCase();
          const cMatch = nodeText.match(/\b(C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\b/i);
          if (cMatch) detectedClass = cMatch[1].toUpperCase();
        }
      }
    }

    // Priority 3: Fallback from document title
    if (detectedSystem === 'Unknown') {
      const titleMatch = (doc.title || '').match(/\b(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})\b/i);
      if (titleMatch) detectedSystem = titleMatch[1].toUpperCase();
      const titleClass = (doc.title || '').match(/\b(C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\b/i);
      if (titleClass) detectedClass = titleClass[1].toUpperCase();
    }

    // --- PHASE 2: Locate Local [n] Header Element ---
    for (const root of searchRoots) {
      const candidates = Array.from(root.querySelectorAll('*')).filter(el => {
        // Exclude buttons, form inputs, scripts
        if (el.tagName && /^(button|input|select|textarea|script|style)$/i.test(el.tagName)) return false;
        const txt = (el.textContent || '').trim();
        return /Local\s*\[\s*\d+\s*\]/i.test(txt) && txt.length < 60;
      });
      // Pick innermost element (shortest textContent)
      candidates.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
      if (candidates.length > 0) {
        matchedHeaderEl = candidates[0];
        const match = matchedHeaderEl.textContent.match(/Local\s*\[\s*(\d+)\s*\]/i);
        if (match) localCount = parseInt(match[1], 10);
        break;
      }
    }

    if (!matchedHeaderEl) {
      return {
        success: false,
        error: 'NO_LOCAL_PANEL_DETECTED',
        message: 'No open Local panel detected. Ensure the Local roster panel is open in Wanderer.',
        pilots: []
      };
    }

    // If localCount is explicitly 0, local is clear
    if (localCount === 0) {
      return {
        success: true,
        system: detectedSystem,
        class: detectedClass,
        count: 0,
        pilots: [],
        message: `Local is clear (0 pilots in ${detectedSystem} (${detectedClass})).`
      };
    }

    // --- PHASE 3: Bound the Local Panel Container ---
    // Walk up from matchedHeaderEl, stopping before escaping into multi-panel sidebar
    let localCard = matchedHeaderEl;
    while (
      localCard.parentElement &&
      localCard.parentElement !== doc.body &&
      !localCard.parentElement.querySelector?.('table') &&
      !/Signatures\s*in/i.test(localCard.parentElement.textContent || '')
    ) {
      localCard = localCard.parentElement;
    }

    // Fallback: If localCard is still just the header itself or has no images, check closest panel/card
    if (localCard === matchedHeaderEl || localCard.querySelectorAll?.('img')?.length === 0) {
      const closestPanel = matchedHeaderEl.closest?.('.panel, .card, [class*="panel"], [class*="card"], [class*="widget"]');
      if (closestPanel && !closestPanel.querySelector?.('table')) {
        localCard = closestPanel;
      } else if (matchedHeaderEl.parentElement && !matchedHeaderEl.parentElement.querySelector?.('table')) {
        localCard = matchedHeaderEl.parentElement;
      }
    }

    // --- PHASE 4: Extract Pilot Entries ---
    const pilots = [];

    // Helper to evaluate and add a pilot row
    function processPilotCandidate(rowEl, pImg = null) {
      if (!rowEl) return;
      // STRICT ISOLATION: Reject any element inside tables or matching other panels
      if ((rowEl.closest && rowEl.closest('table')) || (rowEl.querySelector && rowEl.querySelector('table'))) return;
      const rowText = extractCleanNodeText(rowEl);
      if (/BSG-\d{3}|RIS-\d{3}|SVG-\d{3}|ZCD-\d{3}|ZCG-\d{3}/i.test(rowText)) return;
      if (/Fortizar|Raitaru|Athanor|Keepstar|Astrahus/i.test(rowText)) return;
      if (/\b(?:Korsiki|Wuos|Harerget|Ardallabier|Azer|Lirsautton)\b/i.test(rowText)) return;
      if (/Signatures\s*in/i.test(rowText)) return;

      // 1. Portrait URL
      let portraitUrl = '';
      if (pImg) {
        portraitUrl = pImg.getAttribute('src') || pImg.src || '';
      } else {
        const imgEl = rowEl.querySelector('img[src*="character"], img[src*="portrait"], [class*="portrait"] img, img');
        if (imgEl) {
          const src = imgEl.getAttribute('src') || imgEl.src || '';
          if (!/\/types\//i.test(src) && !/\/brackets\//i.test(src)) {
            portraitUrl = src;
          }
        }
      }

      // 2. Pilot Name and Corp Ticker
      let pilotName = '';
      let corpTicker = '';

      const corpMatch = rowText.match(/([A-Za-z0-9 '\-_]+?)\s*\[([A-Za-z0-9.\-_]{2,8})\]/);
      if (corpMatch) {
        pilotName = clean(corpMatch[1]);
        corpTicker = clean(corpMatch[2]);
      } else {
        const nameEl = rowEl.querySelector?.('.pilot-name, [class*="name"]');
        if (nameEl) {
          pilotName = clean(extractCleanNodeText(nameEl));
        } else {
          pilotName = clean(rowText.split(/\s{2,}|\n/)[0]);
        }
      }

      // Reject non-pilot rows or UI headers
      if (!pilotName || /^(Fortizar|Raitaru|Athanor|Type|Id|Group|Info|Local|Signatures|Timer|Owner)$/i.test(pilotName)) return;
      if (pilotName.length < 2 || pilotName.length > 60) return;

      // 3. Ship Name
      let shipName = '';
      const shipNameEl = rowEl.querySelector?.('.ship-name, [class*="ship-name"]');
      if (shipNameEl) {
        shipName = clean(extractCleanNodeText(shipNameEl));
      } else if (corpMatch) {
        const afterCorp = clean(rowText.substring(corpMatch.index + corpMatch[0].length));
        if (afterCorp) {
          shipName = afterCorp;
        }
      }

      // 4. Ship Type
      let shipType = '';
      const allRowImgs = Array.from(rowEl.querySelectorAll('img'));
      const otherImgs = allRowImgs.filter(i => i !== pImg);
      for (const sImg of otherImgs) {
        shipType = sImg.getAttribute('title') ||
                   sImg.getAttribute('alt') ||
                   sImg.getAttribute('data-ship-type') ||
                   sImg.getAttribute('aria-label') ||
                   sImg.closest?.('[title]')?.getAttribute?.('title') ||
                   sImg.closest?.('[data-tooltip]')?.getAttribute?.('data-tooltip') || '';
        if (shipType) break;
      }

      // Clean shipName if it repeats shipType from tooltip
      if (shipType && shipName) {
        shipName = clean(shipName.replace(new RegExp(`\\b${shipType}\\b`, 'gi'), ''));
        if (!shipName) shipName = '-';
      }

      // Fallback: Infer shipType from shipName if known hull
      if (!shipType && shipName) {
        if (/^Capsule/i.test(shipName)) shipType = 'Capsule';
        else if (/^Nemesis/i.test(shipName)) shipType = 'Nemesis';
        else if (/^Hound/i.test(shipName)) shipType = 'Hound';
        else if (/^Purifier/i.test(shipName)) shipType = 'Purifier';
        else if (/^Manticore/i.test(shipName)) shipType = 'Manticore';
        else {
          const dashParts = shipName.split(/\s*-\s*/);
          if (dashParts.length > 1) {
            shipType = clean(dashParts[0]);
          }
        }
      }

      if (pilotName && !pilots.some(p => p.pilot === pilotName)) {
        pilots.push({
          pilot: pilotName,
          corp: corpTicker,
          shipName: shipName || '-',
          shipType: shipType || '-',
          portraitUrl
        });
      }
    }

    // Strategy 1: Find character portraits inside localCard
    let portraitImgs = Array.from(localCard.querySelectorAll('img')).filter(img => {
      const src = img.getAttribute('src') || '';
      if (/\/types\//i.test(src) || /\/brackets\//i.test(src)) return false;
      return /characters/i.test(src) || /character/i.test(src) ||
             img.classList?.contains('portrait') ||
             img.parentElement?.classList?.contains('pilot-portrait') ||
             img.closest?.('[class*="portrait"]');
    });

    for (const pImg of portraitImgs) {
      let rowEl = pImg.parentElement;
      while (rowEl && rowEl !== localCard && rowEl !== doc.body) {
        const t = extractCleanNodeText(rowEl);
        if (/\[[A-Za-z0-9.\-_]{2,8}\]/.test(t) || t.length > 10) {
          break;
        }
        if (!rowEl.parentElement || rowEl.parentElement === localCard || rowEl.parentElement === doc.body) {
          break;
        }
        rowEl = rowEl.parentElement;
      }
      processPilotCandidate(rowEl || pImg.parentElement || localCard, pImg);
    }

    // Strategy 2: If no pilots found via portraits, find elements with [CORP] ticker in localCard
    if (pilots.length === 0) {
      const allCardEls = Array.from(localCard.querySelectorAll('*'));
      const corpCandidates = allCardEls.filter(el => {
        if (el === matchedHeaderEl || el.contains(matchedHeaderEl)) return false;
        if (el.closest && el.closest('table')) return false;
        const txt = (el.textContent || '').trim();
        return /\[[A-Za-z0-9.\-_]{2,8}\]/.test(txt) && txt.length < 150;
      });
      // Take innermost matching elements
      const innermost = corpCandidates.filter(el => !corpCandidates.some(other => other !== el && el.contains(other)));
      for (const el of innermost) {
        const rowEl = el.closest('div[class*="row"], div[class*="entry"], li') || el.parentElement || el;
        processPilotCandidate(rowEl);
      }
    }

    // Strategy 3: Page-wide fallback for elements with [CORP] ticker strictly outside tables
    if (pilots.length === 0) {
      for (const root of searchRoots) {
        const allPageEls = Array.from(root.querySelectorAll('*'));
        const corpPageEls = allPageEls.filter(el => {
          if (el.closest && el.closest('table')) return false;
          if (el.querySelector && el.querySelector('table')) return false;
          const txt = (el.textContent || '').trim();
          if (/Signatures\s*in|Structures/i.test(txt)) return false;
          return /\[[A-Za-z0-9.\-_]{2,8}\]/.test(txt) && txt.length < 120;
        });
        const innermost = corpPageEls.filter(el => !corpPageEls.some(other => other !== el && el.contains(other)));
        for (const el of innermost) {
          const rowEl = el.closest('div[class*="row"], div[class*="entry"], li') || el.parentElement || el;
          processPilotCandidate(rowEl);
        }
        if (pilots.length > 0) break;
      }
    }

    const success = pilots.length > 0 || localCount === 0;

    return {
      success,
      system: detectedSystem,
      class: detectedClass,
      count: pilots.length,
      pilots,
      message: pilots.length > 0
        ? `Successfully extracted ${pilots.length} pilots from Local roster.`
        : (localCount === 0 
            ? `Local is clear (0 pilots in ${detectedSystem} (${detectedClass})).`
            : `Detected Local [${localCount !== null ? localCount : '?'}], but no pilot rows could be parsed.`),
      debug: {
        url: doc.location?.href || 'unknown',
        headerFound: !!matchedHeaderEl,
        headerText: matchedHeaderEl ? matchedHeaderEl.textContent.trim().substring(0, 60) : 'None',
        localCount,
        localCardTag: localCard ? localCard.tagName : 'None',
        localCardClass: localCard ? (localCard.className || '') : '',
        portraitsFound: portraitImgs.length,
        pilotsFound: pilots.length
      }
    };

  } catch (err) {
    return {
      success: false,
      error: 'EXTRACTION_EXCEPTION',
      message: `Extractor error: ${err.message}`,
      pilots: [],
      debug: {
        exception: err.stack || err.message
      }
    };
  }
}

/**
 * Tactical regex-based HTML extractor for tests and environments without full DOM.
 */
export function extractWandererPilotsFromHtml(htmlString) {
  if (!htmlString || !/Local\s*\[\s*\d+\s*\]/i.test(htmlString)) {
    return {
      success: false,
      error: 'NO_LOCAL_PANEL_DETECTED',
      pilots: []
    };
  }

  // Clean text for system/class identification
  const spacedHtml = htmlString.replace(/<\/?[^>]+(>|$)/g, ' ');
  const cleanText = spacedHtml.replace(/\s+/g, ' ').trim();

  let systemClass = 'Unknown';
  let system = 'Unknown';

  const sigMatch = cleanText.match(/(?:Signatures\s*)?in\s*(C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\s*(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})/i);
  if (sigMatch) {
    systemClass = sigMatch[1].toUpperCase();
    system = sigMatch[2].toUpperCase();
  } else {
    const locMatch = cleanText.match(/(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})\s*\((C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\)/i);
    if (locMatch) {
      system = locMatch[1].toUpperCase();
      systemClass = locMatch[2].toUpperCase();
    } else {
      const titleMatch = cleanText.match(/\b(C[1-6])\s*(J\d{6})\b/i);
      if (titleMatch) {
        systemClass = titleMatch[1].toUpperCase();
        system = titleMatch[2].toUpperCase();
      }
    }
  }

  // Isolate the Local [n] section: find position of Local [n]
  const localIdx = htmlString.search(/Local\s*\[\s*\d+\s*\]/i);
  if (localIdx === -1) {
    return { success: false, error: 'NO_LOCAL_PANEL_DETECTED', pilots: [] };
  }

  const countMatch = htmlString.match(/Local\s*\[\s*(\d+)\s*\]/i);
  const localCount = countMatch ? parseInt(countMatch[1], 10) : null;
  if (localCount === 0) {
    return {
      success: true,
      system,
      class: systemClass,
      count: 0,
      pilots: []
    };
  }

  // Take the section starting at Local [n]
  const localSection = htmlString.substring(localIdx);
  // Cut off if another major panel starts or body ends
  const localChunk = localSection.split(/<div class="panel (?:signatures|structures|route)|<table|<\/body/i)[0];

  // Extract pilot entries from the local chunk
  const pilots = [];
  const rawParts = localChunk.split(/(?=<[^>]*class=["'][^"']*(?:pilot-row|pilot-entry))/i);

  for (const part of rawParts) {
    if (!/class=["'][^"']*(?:pilot-row|pilot-entry)/i.test(part)) continue;
    const blockContent = part.split(/<div class="panel|<footer|<\/body/i)[0];

    // Reject any table row or structure
    if (/<tr|<table|BSG-\d{3}|Fortizar/i.test(blockContent)) continue;

    // 1. Portrait
    const portraitMatch = blockContent.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
    const portraitUrl = portraitMatch ? portraitMatch[1] : '';

    // 2. Pilot Name and Corp
    let pilot = '';
    let corp = '';
    const nameMatch = blockContent.match(/class=["'][^"']*(?:pilot-name|title|name)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i) ||
                      blockContent.match(/([A-Za-z0-9 '\-_]+?)\s*\[([A-Za-z0-9.\-_]{2,8})\]/);

    if (nameMatch) {
      const raw = nameMatch[1].replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();
      const splitCorp = raw.match(/^([A-Za-z0-9 '\-_]+?)(?:\s*\[([A-Za-z0-9.\-_]{2,8})\])?$/);
      if (splitCorp) {
        pilot = splitCorp[1].trim();
        corp = splitCorp[2] ? splitCorp[2].trim() : '';
      } else {
        pilot = raw;
      }
    }

    // 3. Ship Name
    let shipName = '';
    const shipNameMatch = blockContent.match(/class=["'][^"']*(?:ship-name)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i) ||
                          blockContent.match(/<span>(Capsule[^<]*|Into[^<]*|Never[^<]*|[A-Za-z0-9 '\-_]+)<\/span>/i);
    if (shipNameMatch) {
      shipName = shipNameMatch[1].replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // 4. Ship Type
    let shipType = '';
    const shipIconMatch = blockContent.match(/<img[^>]*(?:class=["'][^"']*ship-icon[^"']*["'][^>]*title=["']([^"']+)["']|title=["']([^"']+)["'][^>]*class=["'][^"']*ship-icon[^"']*["'])/i) ||
                          blockContent.match(/title=["'](Capsule|Nemesis|Hound|Purifier|Manticore|[A-Za-z0-9\-]+)["']/i);
    if (shipIconMatch) {
      shipType = shipIconMatch[1] || shipIconMatch[2];
    }

    if (!shipType && shipName) {
      if (/^Capsule/i.test(shipName)) shipType = 'Capsule';
      else if (/^Nemesis/i.test(shipName)) shipType = 'Nemesis';
      else if (/^Hound/i.test(shipName)) shipType = 'Hound';
    }

    if (pilot && !pilots.some(p => p.pilot === pilot)) {
      pilots.push({
        pilot,
        corp,
        shipName: shipName || '-',
        shipType: shipType || '-',
        portraitUrl
      });
    }
  }

  return {
    success: pilots.length > 0,
    system,
    class: systemClass,
    count: pilots.length,
    pilots
  };
}
