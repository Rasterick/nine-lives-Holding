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
          if (n.tagName && (n.tagName.toLowerCase() === 'svg' || (n.classList?.contains && n.classList.contains('icon')))) return;
          if (n.childNodes) {
            for (const child of n.childNodes) {
              walk(child);
            }
          }
        }
      }
      walk(el);
      return pieces.join(' ').replace(/\s+/g, ' ').trim();
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
    let localCount = 0;

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
        const activeNode = root.querySelector('.system-node.active, g.active, [aria-selected="true"]');
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

    // --- PHASE 2: Locate Local [n] Panel Container ---
    for (const root of searchRoots) {
      const allEls = Array.from(root.querySelectorAll('*'));
      for (const el of allEls) {
        const txt = el.textContent || '';
        const match = txt.match(/Local\s*\[\s*(\d+)\s*\]/i);
        if (match && txt.length < 100) {
          matchedHeaderEl = el;
          localCount = parseInt(match[1], 10);
          break;
        }
      }
      if (matchedHeaderEl) break;
    }

    if (!matchedHeaderEl) {
      return {
        success: false,
        error: 'NO_LOCAL_PANEL_DETECTED',
        message: 'No open Local panel detected. Ensure the Local roster panel is open in Wanderer.',
        pilots: []
      };
    }

    // Find the enclosing card or container for the Local panel
    let panelContainer = matchedHeaderEl;
    for (let i = 0; i < 5 && panelContainer; i++) {
      if (panelContainer.parentElement && (
        panelContainer.parentElement.classList?.contains('panel') ||
        panelContainer.parentElement.classList?.contains('card') ||
        panelContainer.parentElement.classList?.contains('local-panel') ||
        panelContainer.parentElement.querySelectorAll('img').length >= 1
      )) {
        panelContainer = panelContainer.parentElement;
        break;
      }
      panelContainer = panelContainer.parentElement;
    }
    if (!panelContainer) panelContainer = matchedHeaderEl.parentElement || doc.body;

    // --- PHASE 3: Extract Pilot Entries ---
    const pilots = [];

    // Candidate rows in the panel: look for elements containing an image or pilot info
    const rowCandidates = Array.from(panelContainer.querySelectorAll('.pilot-row, .pilot-entry, tr, [role="row"], li, div[class*="row"]'));
    const rows = rowCandidates.filter(r => {
      // Must contain at least one img or avatar, and not be the header itself
      return r.querySelectorAll('img').length > 0 && !/Local\s*\[/i.test(r.textContent);
    });

    // If specific row classes weren't matched, find immediate parent of portrait images
    const activeRows = rows.length > 0 ? rows : (() => {
      const imgs = Array.from(panelContainer.querySelectorAll('img')).filter(img => {
        const src = img.getAttribute('src') || '';
        return /characters/i.test(src) || img.classList?.contains('portrait') || img.parentElement?.classList?.contains('pilot-portrait');
      });
      return imgs.map(img => img.closest('div[class*="entry"], div[class*="row"], tr, li') || img.parentElement?.parentElement || img.parentElement).filter(Boolean);
    })();

    for (const r of activeRows) {
      // 1. Portrait URL
      let portraitUrl = '';
      const imgs = Array.from(r.querySelectorAll('img'));
      for (const img of imgs) {
        const src = img.getAttribute('src') || '';
        if (/characters/i.test(src) || img.classList?.contains('portrait') || !portraitUrl) {
          portraitUrl = src;
          if (/characters/i.test(src)) break;
        }
      }

      // 2. Pilot Name and Corp Ticker
      let pilotName = '';
      let corpTicker = '';

      // Check for pilot name container or text
      const nameEl = r.querySelector('.pilot-name, [class*="name"], div:first-child') || r;
      const rawNameText = extractCleanNodeText(nameEl);

      // Match "Pilot Name [CORP]" or "Pilot Name"
      const nameMatch = rawNameText.match(/^([A-Za-z0-9 '\-_]+?)(?:\s*\[([A-Za-z0-9.\-_]{2,8})\])?(?:\s+(?:Capsule|Into|Ship).*|$)/i) ||
                        rawNameText.match(/^([A-Za-z0-9 '\-_]+?)(?:\s*\[([A-Za-z0-9.\-_]{2,8})\])?$/);
      if (nameMatch) {
        pilotName = clean(nameMatch[1]);
        corpTicker = clean(nameMatch[2] || '');
      } else {
        pilotName = clean(rawNameText.replace(/\[.*?\]/, ''));
        const corpMatch = rawNameText.match(/\[([A-Za-z0-9.\-_]{2,8})\]/);
        if (corpMatch) corpTicker = corpMatch[1];
      }

      // 3. Ship Name
      let shipName = '';
      const shipNameEl = r.querySelector('.ship-name, [class*="ship-name"], .pilot-ship span');
      if (shipNameEl) {
        shipName = clean(extractCleanNodeText(shipNameEl));
      } else {
        const shipContainer = r.querySelector('.pilot-ship, [class*="ship"]');
        if (shipContainer) {
          shipName = clean(extractCleanNodeText(shipContainer));
        }
      }

      // 4. Ship Type
      let shipType = '';
      const shipIconEl = r.querySelector('.ship-icon, img[class*="ship"], [title]:not([class*="portrait"])');
      if (shipIconEl) {
        shipType = shipIconEl.getAttribute('title') ||
                   shipIconEl.getAttribute('alt') ||
                   shipIconEl.getAttribute('data-ship-type') || '';
      }

      // If shipType is still empty, check all images in row that are not the portrait
      if (!shipType) {
        for (const img of imgs) {
          if (img.getAttribute('src') !== portraitUrl) {
            shipType = img.getAttribute('title') || img.getAttribute('alt') || '';
            if (shipType) break;
          }
        }
      }

      // Defense against ship name also containing ship type
      if (!shipType && shipName) {
        const parts = shipName.split(/\s*-\s*/);
        if (parts.length > 1) {
          shipType = clean(parts[0]);
        }
      }

      if (pilotName) {
        pilots.push({
          pilot: pilotName,
          corp: corpTicker,
          shipName: shipName || '-',
          shipType: shipType || '-',
          portraitUrl: portraitUrl || ''
        });
      }
    }

    return {
      success: pilots.length > 0,
      system: detectedSystem,
      class: detectedClass,
      count: pilots.length,
      pilots,
      message: pilots.length > 0
        ? `Successfully extracted ${pilots.length} pilots from Local roster.`
        : 'Found Local panel, but could not parse pilot entries.'
    };

  } catch (err) {
    return {
      success: false,
      error: 'EXTRACTION_EXCEPTION',
      message: `Extractor error: ${err.message}`,
      pilots: []
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

  // Extract pilot entries
  const pilots = [];
  // Split HTML into row chunks starting with pilot-row or pilot-entry
  const rawParts = htmlString.split(/(?=<[^>]*class=["'][^"']*(?:pilot-row|pilot-entry))/i);

  for (const part of rawParts) {
    if (!/class=["'][^"']*(?:pilot-row|pilot-entry)/i.test(part)) continue;
    // Restrict chunk to this entry (stop at next entry or container closing)
    const blockContent = part.split(/<div class="panel|<footer|<\/body/i)[0];

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
                          blockContent.match(/<span>(Capsule[^<]*|Into[^<]*|[A-Za-z0-9 '\-_]+)<\/span>/i);
    if (shipNameMatch) {
      shipName = shipNameMatch[1].replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // 4. Ship Type
    let shipType = '';
    const shipIconMatch = blockContent.match(/<img[^>]*(?:class=["'][^"']*ship-icon[^"']*["'][^>]*title=["']([^"']+)["']|title=["']([^"']+)["'][^>]*class=["'][^"']*ship-icon[^"']*["'])/i) ||
                          blockContent.match(/title=["'](Capsule|Nemesis|[A-Za-z0-9\-]+)["']/i);
    if (shipIconMatch) {
      shipType = shipIconMatch[1] || shipIconMatch[2];
    }

    if (pilot) {
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
