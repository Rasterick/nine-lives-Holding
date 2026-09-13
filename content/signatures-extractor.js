// content/signatures-extractor.js

/**
 * Self-contained tactical extractor for Wanderer cosmic signatures.
 * Designed for execution inside browser tabs via chrome.scripting.executeScript.
 * Contains ALL helper functions internally to guarantee zero ReferenceErrors.
 */
export function extractWandererSignatures(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) {
    return { success: false, error: 'NO_DOCUMENT_AVAILABLE', signatures: [] };
  }

  try {
    // Internal helper functions (scoped inside to ensure executeScript serialization)
    function clean(str) {
      return (str || '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Walks DOM node tree and extracts text pieces joined by spaces.
     * Prevents text in adjacent spans from being glued together without whitespace.
     */
    function extractCleanNodeText(el) {
      if (!el) return '';
      const pieces = [];
      function walk(n) {
        if (n.nodeType === 3) {
          const val = (n.nodeValue || '').trim();
          if (val) pieces.push(val);
        } else if (n.nodeType === 1) {
          // Skip icons and SVGs
          if (n.tagName && (n.tagName.toLowerCase() === 'svg' || n.classList?.contains('icon'))) return;
          for (const child of n.childNodes) {
            walk(child);
          }
        }
      }
      walk(el);
      let text = pieces.join(' ').replace(/\s+/g, ' ').trim();

      // Defense-in-depth: Normalize wormhole target strings if glued without spaces
      // e.g. AC247C3J172701 -> A C247 C3 J172701
      // e.g. DX877C4J120409 -> D X877 C4 J120409
      // e.g. EU574C6J120512 -> E U574 C6 J120512
      // e.g. BH900C5J141204 -> B H900 C5 J141204
      const whGlued = text.match(/^([A-Z])\s*([A-Z0-9]{4})\s*(C[1-6]|Highsec|Lowsec|Nullsec|Pochven|HS|LS|NS)\s*(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})$/i);
      if (whGlued) {
        text = `${whGlued[1].toUpperCase()} ${whGlued[2].toUpperCase()} ${whGlued[3].toUpperCase()} ${whGlued[4].toUpperCase()}`;
      } else {
        const leadGlued = text.match(/^([A-Z])([A-Z]\d{3})\b/);
        if (leadGlued) {
          text = text.replace(/^([A-Z])([A-Z]\d{3})/, '$1 $2');
        }
      }

      return text;
    }

    function extractSigId(text) {
      if (!text) return '';
      const match = text.match(/\b([A-Z]{3}-\d{3})\b/i);
      if (match) return match[1].toUpperCase();
      const partial = text.match(/\b([A-Z]{3})\b/i);
      return partial ? partial[1].toUpperCase() : clean(text);
    }

    const KNOWN_GROUPS = new Set([
      'WORMHOLE', 'COMBAT SITE', 'ORE SITE', 'RELIC SITE', 'DATA SITE', 'GAS SITE',
      'COSMIC ANOMALY', 'COSMIC SIGNATURE'
    ]);

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
    let headerTextSample = '';
    let matchedHeaderEl = null;
    let strategyUsed = 'NONE';
    const allTableHeadersSample = [];

    // --- PHASE 1: Locate Signatures Header / Container ---
    for (const root of searchRoots) {
      const allEls = Array.from(root.querySelectorAll('*'));
      
      // Find element containing "Signatures in" or "Signatures"
      for (const el of allEls) {
        if (/Signatures\s*in/i.test(el.textContent)) {
          const txt = extractCleanNodeText(el);
          if (txt.length < 200) {
            matchedHeaderEl = el;
            headerTextSample = txt;
            break;
          }
        }
      }
      if (matchedHeaderEl) break;
    }

    // Parse system and class from header text
    if (headerTextSample) {
      // 1. Direct regex matching "Signatures in C4 J215758", "in C4 J215758", or "inC4J215758"
      const directMatch = headerTextSample.match(/(?:Signatures\s*)?in\s*(C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\s*(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})/i);
      if (directMatch) {
        detectedClass = directMatch[1].toUpperCase();
        detectedSystem = directMatch[2].toUpperCase();
      } else {
        // Fallback: match Class
        const classMatch = headerTextSample.match(/\b(C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\b/i) ||
                           headerTextSample.match(/in\s*(C[1-6])/i);
        if (classMatch) {
          detectedClass = classMatch[1].toUpperCase();
        }

        // Fallback: match System (J-space J###### or Nullsec code)
        const jMatch = headerTextSample.match(/\b(J\d{6})\b/i);
        if (jMatch) {
          detectedSystem = jMatch[1].toUpperCase();
        } else {
          const sysMatch = headerTextSample.match(/\b([0-9A-Z]{1,4}-[0-9A-Z]{1,4})\b/i);
          if (sysMatch) {
            detectedSystem = sysMatch[1].toUpperCase();
          } else {
            // Find named system words, strictly filtering out UI words
            const words = headerTextSample.split(/\s+/);
            for (const w of words) {
              const cleanW = w.replace(/[^a-zA-Z0-9\-]/g, '');
              if (
                cleanW.length >= 3 &&
                !/^(Signatures|in|Lazy|delete|Filter|Search|Close|Add|Sort)$/i.test(cleanW) &&
                !/^(C[1-6]|Highsec|Lowsec|Nullsec|Pochven)$/i.test(cleanW) &&
                !/^\d+$/.test(cleanW) &&
                !cleanW.startsWith('in') &&
                !cleanW.endsWith('Lazy')
              ) {
                detectedSystem = cleanW;
                break;
              }
            }
          }
        }
      }
    }

    // --- PHASE 2: Find Signatures Table / Grid ---
    let signatures = [];

    // Candidate containers starting near header up to document body
    const candidateContainers = [];
    if (matchedHeaderEl) {
      let curr = matchedHeaderEl;
      for (let i = 0; i < 5 && curr; i++) {
        candidateContainers.push(curr);
        curr = curr.parentElement;
      }
    }
    for (const root of searchRoots) {
      if (root.body) candidateContainers.push(root.body);
    }

    for (const container of candidateContainers) {
      const tables = Array.from(container.querySelectorAll('table'));
      for (const tbl of tables) {
        const ths = Array.from(tbl.querySelectorAll('th, thead td, tr:first-child td, [role="columnheader"]'));
        const thTexts = ths.map(th => extractCleanNodeText(th).toLowerCase());
        if (thTexts.length > 0) {
          allTableHeadersSample.push(thTexts.slice(0, 5).join(' | '));
        }

        let idIdx = -1;
        let grpIdx = -1;
        let infoIdx = -1;

        thTexts.forEach((t, idx) => {
          if (/\bid\b/i.test(t) && idIdx === -1) idIdx = idx;
          else if (/\bgroup\b/i.test(t) && grpIdx === -1) grpIdx = idx;
          else if (/\binfo\b/i.test(t) && infoIdx === -1) infoIdx = idx;
        });

        const rows = Array.from(tbl.querySelectorAll('tbody tr, tr')).filter(r => !r.querySelector('th'));
        if (rows.length > 0) {
          let hasSigRow = false;
          for (const r of rows.slice(0, 5)) {
            if (/\b[A-Z]{3}-\d{3}\b/i.test(r.textContent)) {
              hasSigRow = true;
              break;
            }
          }

          if (idIdx !== -1 || grpIdx !== -1 || hasSigRow) {
            strategyUsed = 'HTML_TABLE_EXACT';
            if (idIdx === -1) idIdx = 0;
            if (grpIdx === -1) grpIdx = 1;
            if (infoIdx === -1) infoIdx = 2;

            for (const r of rows) {
              const cells = Array.from(r.querySelectorAll('td, [role="cell"]'));
              if (cells.length >= 2) {
                const rawId = extractCleanNodeText(cells[idIdx] || cells[0]);
                const id = extractSigId(rawId);
                const group = extractCleanNodeText(cells[grpIdx] || cells[1]) || '-';
                const info = cells[infoIdx] ? extractCleanNodeText(cells[infoIdx]) : '-';

                if (id && id !== '-') {
                  signatures.push({ id, group, info });
                }
              }
            }
            if (signatures.length > 0) break;
          }
        }
      }
      if (signatures.length > 0) break;
    }

    // Search Strategy 2: Grid / Virtualized rows with role="row"
    if (signatures.length === 0) {
      for (const root of searchRoots) {
        const gridRows = Array.from(root.querySelectorAll('[role="row"], div[class*="row"], div[class*="Row"]'))
          .filter(r => !r.querySelector('[role="columnheader"]'));

        for (const r of gridRows) {
          const cells = Array.from(r.querySelectorAll('[role="cell"], div[class*="cell"], div[class*="Cell"]'));
          if (cells.length >= 2) {
            const rawId = extractCleanNodeText(cells[0]);
            const id = extractSigId(rawId);
            const group = extractCleanNodeText(cells[1]) || '-';
            const info = cells[2] ? extractCleanNodeText(cells[2]) : '-';

            if (id && id !== '-' && /\b[A-Z]{3}-\d{3}\b/i.test(id)) {
              signatures.push({ id, group, info });
            }
          }
        }
        if (signatures.length > 0) {
          strategyUsed = 'GRID_ROWS';
          break;
        }
      }
    }

    // Search Strategy 3: Text scanning inside panel container
    if (signatures.length === 0 && matchedHeaderEl) {
      const panel = matchedHeaderEl.closest('div, section, aside') || doc.body;
      const textLines = panel.innerText ? panel.innerText.split('\n') : [];
      
      for (let i = 0; i < textLines.length; i++) {
        const line = clean(textLines[i]);
        const sigMatch = line.match(/\b([A-Z]{3}-\d{3})\b/i);
        if (sigMatch) {
          const id = sigMatch[1].toUpperCase();
          let group = '-';
          let info = '-';

          for (const g of KNOWN_GROUPS) {
            if (line.toUpperCase().includes(g)) {
              group = g;
              info = clean(line.replace(id, '').replace(g, ''));
              break;
            }
          }
          if (group === '-' && i + 1 < textLines.length) {
            const nextLine = clean(textLines[i + 1]);
            for (const g of KNOWN_GROUPS) {
              if (nextLine.toUpperCase().includes(g)) {
                group = g;
                info = i + 2 < textLines.length ? clean(textLines[i + 2]) : '-';
                break;
              }
            }
          }

          signatures.push({ id, group, info });
        }
      }
      if (signatures.length > 0) {
        strategyUsed = 'TEXT_SCAN_FALLBACK';
      }
    }

    // Try to fallback system name from document title if still unknown
    if (detectedSystem === 'Unknown') {
      const titleMatch = (doc.title || '').match(/\b(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})\b/i);
      if (titleMatch) detectedSystem = titleMatch[1].toUpperCase();
    }

    const success = signatures.length > 0;

    return {
      success,
      system: detectedSystem,
      class: detectedClass,
      signatures,
      count: signatures.length,
      message: success 
        ? `Successfully extracted ${signatures.length} signatures.` 
        : (matchedHeaderEl 
            ? `Found panel "${headerTextSample}", but could not extract table rows.` 
            : 'No open Signatures panel detected. Click a system on the Wanderer map to view its signatures.'),
      debug: {
        url: doc.location?.href || 'unknown',
        headerFound: !!matchedHeaderEl,
        headerTextSample: headerTextSample.substring(0, 80),
        tableHeadersSample: allTableHeadersSample.slice(0, 3),
        strategyUsed,
        rowsScanned: signatures.length
      }
    };

  } catch (err) {
    return {
      success: false,
      error: 'EXTRACTION_EXCEPTION',
      message: `Extractor error: ${err.message}`,
      signatures: [],
      debug: {
        exception: err.stack || err.message,
        url: doc.location?.href || 'unknown'
      }
    };
  }
}

/**
 * Helper for running in Node.js test environments without native browser DOM.
 */
export function extractWandererSignaturesFromHtml(htmlString) {
  const spacedHtml = htmlString.replace(/<\/?[^>]+(>|$)/g, ' ');
  const cleanText = spacedHtml.replace(/\s+/g, ' ').trim();

  let systemClass = 'Unknown';
  let system = 'Unknown';

  const directMatch = cleanText.match(/(?:Signatures\s*)?in\s*(C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\s*(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})/i);
  if (directMatch) {
    systemClass = directMatch[1].toUpperCase();
    system = directMatch[2].toUpperCase();
  }

  const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
  const signatures = [];
  let m;

  while ((m = rowRegex.exec(htmlString)) !== null) {
    const cleanCol0 = m[1].replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanCol1 = m[2].replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();
    let cleanCol2 = m[3].replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();

    const whGlued = cleanCol2.match(/^([A-Z])\s*([A-Z0-9]{4})\s*(C[1-6]|Highsec|Lowsec|Nullsec|Pochven|HS|LS|NS)\s*(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})$/i);
    if (whGlued) {
      cleanCol2 = `${whGlued[1].toUpperCase()} ${whGlued[2].toUpperCase()} ${whGlued[3].toUpperCase()} ${whGlued[4].toUpperCase()}`;
    }

    const idMatch = cleanCol0.match(/([A-Z]{3}-\d{3})/i);
    if (idMatch) {
      signatures.push({
        id: idMatch[1].toUpperCase(),
        group: cleanCol1,
        info: cleanCol2
      });
    }
  }

  return {
    success: signatures.length > 0,
    system,
    class: systemClass,
    signatures,
    count: signatures.length
  };
}
