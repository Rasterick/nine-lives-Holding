// content/signatures-extractor.js

/**
 * Normalizes inner text from an HTML cell, collapsing nested badges and whitespace.
 */
function extractCleanCellText(cell) {
  if (!cell) return '';
  return cell.textContent
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts the 3-letter or standard cosmic signature ID.
 */
function extractSigId(text) {
  const match = text.match(/\b([A-Z]{3}-\d{3})\b/i);
  if (match) return match[1].toUpperCase();
  const partial = text.match(/\b([A-Z]{3})\b/i);
  return partial ? partial[1].toUpperCase() : text.trim();
}

/**
 * Core extraction logic operating on a DOM Document or element root in a live browser tab.
 */
export function extractWandererSignatures(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) {
    return { success: false, error: 'NO_DOCUMENT_AVAILABLE', signatures: [] };
  }

  // 1. Locate Signatures Header & Container
  const searchRoots = [doc];
  const iframes = Array.from(doc.querySelectorAll?.('iframe') || []);
  for (const f of iframes) {
    try {
      if (f.contentDocument) searchRoots.push(f.contentDocument);
    } catch {}
  }

  let matchedHeaderEl = null;
  let system = 'Unknown';
  let systemClass = 'Unknown';

  const sigHeaderRegex = /(?:\[\d+\]\s*)?Signatures\s+in\s+([A-Z0-9]+)\s+([A-Z0-9\-]+)/i;

  for (const root of searchRoots) {
    // Check elements with text containing "Signatures in"
    const candidates = Array.from(root.querySelectorAll('*')).filter(el => {
      return el.children.length <= 4 && /Signatures\s+in/i.test(el.textContent);
    });

    for (const el of candidates) {
      const txt = el.textContent.replace(/\s+/g, ' ').trim();
      const m = txt.match(sigHeaderRegex);
      if (m) {
        matchedHeaderEl = el;
        // Determine whether group 1 is class and group 2 is system, or vice versa
        if (/^C\d{1,2}$/i.test(m[1]) || /^(Highsec|Lowsec|Nullsec|Pochven)$/i.test(m[1])) {
          systemClass = m[1].toUpperCase();
          system = m[2];
        } else {
          system = m[1];
          systemClass = m[2].toUpperCase();
        }
        break;
      }
    }
    if (matchedHeaderEl) break;
  }

  if (!matchedHeaderEl) {
    return {
      success: false,
      error: 'NO_SIGNATURES_PANEL_OPEN',
      message: 'No open Signatures panel detected. Click a system on the Wanderer map to view its signatures.',
      signatures: []
    };
  }

  // Find enclosing widget/panel container
  const panelContainer = matchedHeaderEl.closest('.signatures-panel, [class*="signature"], [class*="drawer"], [class*="window"], aside, [role="dialog"]') ||
                         matchedHeaderEl.parentElement?.parentElement ||
                         doc.body;

  const signatures = [];

  // Strategy A: HTML Table rows
  const rows = Array.from(panelContainer.querySelectorAll('tbody tr, table tr')).filter(r => !r.querySelector('th'));
  if (rows.length > 0) {
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td, [role="cell"]'));
      if (cells.length >= 2) {
        const rawId = extractCleanCellText(cells[0]);
        const id = extractSigId(rawId);
        const group = extractCleanCellText(cells[1]) || '-';
        const info = cells[2] ? extractCleanCellText(cells[2]) : '-';

        if (id && id !== '-') {
          signatures.push({ id, group, info });
        }
      }
    }
  }

  // Strategy B: Grid / Virtualized rows with role="row"
  if (signatures.length === 0) {
    const gridRows = Array.from(panelContainer.querySelectorAll('[role="row"]')).filter(r => !r.querySelector('[role="columnheader"]'));
    for (const r of gridRows) {
      const cells = Array.from(r.querySelectorAll('[role="cell"], div[class*="cell"]'));
      if (cells.length >= 2) {
        const rawId = extractCleanCellText(cells[0]);
        const id = extractSigId(rawId);
        const group = extractCleanCellText(cells[1]) || '-';
        const info = cells[2] ? extractCleanCellText(cells[2]) : '-';
        if (id && id !== '-') {
          signatures.push({ id, group, info });
        }
      }
    }
  }

  return {
    success: true,
    system,
    class: systemClass,
    signatures,
    count: signatures.length
  };
}

/**
 * Helper for running in Node.js test environments without native browser DOM.
 */
export function extractWandererSignaturesFromHtml(htmlString) {
  const cleanText = htmlString.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const headerMatch = cleanText.match(/(?:\[\d+\]\s*)?Signatures\s+in\s+([A-Z0-9]+)\s+([A-Z0-9\-]+)/i);
  let systemClass = 'Unknown';
  let system = 'Unknown';

  if (headerMatch) {
    if (/^C\d{1,2}$/i.test(headerMatch[1]) || /^(Highsec|Lowsec|Nullsec|Pochven)$/i.test(headerMatch[1])) {
      systemClass = headerMatch[1].toUpperCase();
      system = headerMatch[2];
    } else {
      system = headerMatch[1];
      systemClass = headerMatch[2].toUpperCase();
    }
  }

  const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
  const signatures = [];
  let m;

  while ((m = rowRegex.exec(htmlString)) !== null) {
    const cleanCol0 = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanCol1 = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanCol2 = m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

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
    success: true,
    system,
    class: systemClass,
    signatures,
    count: signatures.length
  };
}
