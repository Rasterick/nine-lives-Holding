// content/extractor.js

/**
 * Robust tactical extractor for Wanderer EVE Online map topology.
 * Uses Container-Locked extraction on map nodes (.react-flow__node, g.node)
 * and strictly filters out overlay windows (Routes, Signatures table, Structures, System Info).
 */
export function extractWandererSvgData() {
  if (typeof document === 'undefined') {
    return { success: false, error: 'NO_DOCUMENT_AVAILABLE', clusters: [] };
  }

  // Regex definitions
  const jSpaceRegex = /\b(J\d{6})\b/i;
  const cosmicSigFullRegex = /^[A-Z]{3}-\d{3}$/i;
  const threeLetterSigRegex = /^([A-Z]{3}|[$*~#!?][A-Z0-9]{2,3})$/i;
  const classRegex = /^(C\d{1,2}|Highsec|Lowsec|Nullsec|Pochven|HS|LS|NS)$/i;

  function isNullsecSystem(str) {
    if (!str) return false;
    const clean = str.trim().toUpperCase();
    if (cosmicSigFullRegex.test(clean)) return false;
    return /^[0-9A-Z]{1,4}-[0-9A-Z]{1,4}$/.test(clean);
  }

  const EVE_REGIONS = new Set([
    'GENESIS', 'THE CITADEL', 'DOMAIN', 'THE FORGE', 'SINQ LAISON', 'LONETREK',
    'METROPOLIS', 'HEIMATAR', 'DERELIK', 'DEVOID', 'EVERYSHORE', 'PLACID',
    'VERGE VENDOR', 'SOLITUDE', 'ARIDIA', 'KADOR', 'KOR-AZOR', 'TASH-MURKON',
    'BLACK RISE', 'THE BLEAK LANDS', 'CATCH', 'CURSE', 'DELVE', 'ESOTERIA',
    'FOUNTAIN', 'IMMENSEA', 'INSMOTHER', 'MALPAIS', 'OMIST', 'OUTER RING',
    'PARAGON SOUL', 'PERIOD BASIS', 'PERRIGEN FALLS', 'PROVIDENCE', 'PURE BLIND',
    'QUERIOUS', 'SCALDING PASS', 'SMALERAIN', 'STAIN', 'SYNDICATE', 'TENIFEROS',
    'TRIBUTE', 'VALE OF THE SILENT', 'VENAL', 'WICKED CREEK'
  ]);

  const namedSystems = new Set([
    'JITA', 'THERA', 'AMAMAKE', 'POITOT', 'HEK', 'DODIXIE', 'RENS', 'AMARR',
    'RANCER', 'TAMA', 'NIARJA', 'B-R5RB', 'M-OEE8', 'V-3YG7',
    'ORDUIN', 'LOGUTTUR', 'MERCOMESIER', 'ZORORZIH', 'AIKANTOH', 'APANAKE',
    'PAKHSHI', 'KASSIGAINEN'
  ]);

  function isSystemIdentifier(token) {
    if (!token) return false;
    const clean = token.trim().toUpperCase();
    if (cosmicSigFullRegex.test(clean)) return false;
    if (jSpaceRegex.test(clean)) return true;
    if (isNullsecSystem(clean)) return true;
    if (namedSystems.has(clean)) return true;
    return false;
  }

  function cleanToken(t) {
    return (t || '').trim().replace(/^[\s\-\|\,\;]+|[\s\-\|\,\;]+$/g, '');
  }

  // Detect and exclude overlay windows/panels (Routes, Signatures tables, Structures, Kills, Comments, Info modals)
  function isOverlayUI(el) {
    if (!el || typeof el.closest !== 'function') return false;
    // Map nodes on the canvas are never overlay UI
    if (el.classList?.contains('react-flow__node') || el.closest('.react-flow__node')) {
      return false;
    }
    return !!el.closest(
      '.react-flow__panel, aside, nav, [role="dialog"], [class*="drawer"], [class*="modal"], [class*="window"], [class*="routes"]'
    );
  }

  const searchRoots = [document];
  const iframes = Array.from(document.querySelectorAll('iframe'));
  for (const f of iframes) {
    try {
      if (f.contentDocument) searchRoots.push(f.contentDocument);
    } catch {}
  }

  // 1. Target Map Node Containers (.react-flow__node, [class*="node"], g.node)
  const mapNodes = [];
  for (const root of searchRoots) {
    let nodeContainers = Array.from(root.querySelectorAll(
      '.react-flow__node, [class*="system-node"], [class*="systemNode"], ' +
      '[data-testid*="node"], [data-id*="system"], g.node, g[class*="node"]'
    ));

    // If no designated node classes found, check SVG <g> elements
    if (nodeContainers.length === 0) {
      const svgs = Array.from(root.querySelectorAll('svg'));
      for (const s of svgs) {
        const groups = Array.from(s.querySelectorAll('g'));
        nodeContainers = nodeContainers.concat(groups);
      }
    }

    for (const container of nodeContainers) {
      if (isOverlayUI(container)) continue;
      mapNodes.push(container);
    }
  }

  const clusters = [];
  const seenSystems = new Set();

  // 2. Extract strictly from inside each node's container (Container-Locking)
  for (const container of mapNodes) {
    // Collect text from LEAF elements only (prevents concatenated parent strings like ORXC1D1.4LJ101408)
    const allDescendants = Array.from(container.querySelectorAll('*'));
    const leafEls = allDescendants.filter(el => el.children.length === 0);

    const leafTokens = [];
    for (const el of leafEls) {
      const txt = cleanToken(el.textContent);
      // Skip empty, overly long smashed strings, or UI buttons
      if (!txt || txt.length > 25 || /^(zoom|reset|search|filter|\+|\-)$/i.test(txt)) continue;
      if (txt.length > 10 && /[A-Z]{3,}\d{2,}/.test(txt) && !jSpaceRegex.test(txt)) continue;
      leafTokens.push(txt);
    }

    // Support SVG text / tspan
    const svgTexts = Array.from(container.querySelectorAll('text, tspan'))
      .map(el => cleanToken(el.textContent))
      .filter(t => t.length > 0 && t.length < 25);
    for (const t of svgTexts) leafTokens.push(t);

    // Identify system anchor in leaf tokens
    let sysName = null;
    for (const t of leafTokens) {
      const clean = t.toUpperCase();
      if (jSpaceRegex.test(clean)) {
        sysName = clean.match(jSpaceRegex)[1].toUpperCase();
        break;
      }
      if (namedSystems.has(clean)) {
        sysName = t; // preserve casing
        break;
      }
      if (isNullsecSystem(clean)) {
        sysName = clean;
        break;
      }
    }

    // Dynamic fallback for any K-Space solar system name on a map node
    if (!sysName) {
      for (const t of leafTokens) {
        const clean = t.toUpperCase();
        if (
          /^[A-Z][a-zA-Z0-9\-\'\s]{2,20}$/.test(t) &&
          !/^(1\.0|0\.[0-9])$/.test(t) &&
          !classRegex.test(clean) &&
          !threeLetterSigRegex.test(clean) &&
          !cosmicSigFullRegex.test(clean) &&
          !/^([A-Z]\d*(\.\d+)?|[A-Z]{1,2}|\d+\.\d+|\[.*?\])$/i.test(t) &&
          !EVE_REGIONS.has(clean) &&
          !['AND', 'THE', 'FOR', 'OUT', 'NEW', 'SEC', 'MAP', 'SYSTEM', 'NODE', 'STATUS', 'TIMER'].includes(clean)
        ) {
          sysName = t;
          break;
        }
      }
    }

    if (sysName && !seenSystems.has(sysName.toUpperCase())) {
      seenSystems.add(sysName.toUpperCase());

      const nodeTokens = [sysName];
      const isHome = sysName.toUpperCase() === 'J113907' || sysName.toLowerCase().includes('home');

      // Signature: Look for 3-letter code or full cosmic sig inside THIS node container
      if (!isHome) {
        for (const t of leafTokens) {
          const clean = t.toUpperCase();
          if ((threeLetterSigRegex.test(clean) || cosmicSigFullRegex.test(clean)) &&
              !classRegex.test(clean) && clean !== sysName.toUpperCase() &&
              !['AND', 'THE', 'FOR', 'OUT', 'NEW', 'SEC', 'MAP'].includes(clean) &&
              !namedSystems.has(clean)) {
            nodeTokens.push(clean.includes('-') ? clean.split('-')[0] : clean);
            break;
          }
        }
      }

      // Class: Look for C1-C6, Highsec, Lowsec, Nullsec inside THIS node container or CSS class
      let foundClass = false;
      for (const t of leafTokens) {
        if (classRegex.test(t)) {
          nodeTokens.push(t.toUpperCase().startsWith('C') ? t.toUpperCase() : t);
          foundClass = true;
          break;
        }
      }
      if (!foundClass) {
        const cls = (container.className || '') + ' ' + (container.getAttribute?.('data-class') || '');
        const m = cls.match(/\b(c[1-6]|highsec|lowsec|nullsec|pochven)\b/i);
        if (m) nodeTokens.push(m[1].toUpperCase());
      }

      // Pilots: Look for 1-3 digit integer inside THIS node container
      for (const t of leafTokens) {
        if (/^\d{1,3}$/.test(t) && t !== '0') {
          nodeTokens.push(t);
          break;
        }
      }

      // Statics & Tags: E.g. D1.1, D1.4, H, L, B, C6, PG, C3, C5, [HOME ACTIVE]
      for (const t of leafTokens) {
        if (t === sysName || nodeTokens.includes(t)) continue;
        // Match statics (D1.1, E1.4), single/double letter effects (B, L, H, N, PG), or bracketed tags
        if (/^([A-Z]\d*(\.\d+)?|[A-Z]{1,2}|\d+\.\d+|\[.*?\])$/i.test(t)) {
          nodeTokens.push(t);
        }
      }

      clusters.push(Array.from(new Set(nodeTokens)).join(' | '));
    }
  }

  // 3. Fallback: If no map nodes found via container pass, do leaf text search on canvas only
  if (clusters.length === 0) {
    for (const root of searchRoots) {
      const allTexts = Array.from(root.querySelectorAll('text, tspan, div, span, p'))
        .filter(el => !isOverlayUI(el))
        .map(el => cleanToken(el.textContent))
        .filter(t => t.length > 0 && t.length < 25);

      for (const t of allTexts) {
        if (isSystemIdentifier(t) && !seenSystems.has(t.toUpperCase())) {
          seenSystems.add(t.toUpperCase());
          clusters.push(t);
        }
      }
    }
  }

  console.log('[NINE LIVES EXTRACTOR] Clean Map Scan Results:', {
    success: clusters.length > 0,
    systemCount: clusters.length,
    clusters
  });

  return {
    success: clusters.length > 0,
    clusters,
    systemCount: clusters.length,
    timestamp: new Date().toISOString(),
    error: clusters.length === 0 ? 'NO_SYSTEM_NODES_IDENTIFIED' : undefined
  };
}

if (typeof window !== 'undefined') {
  window.extractWandererSvgData = extractWandererSvgData;
}


