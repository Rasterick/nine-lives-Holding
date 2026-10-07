// content/topology-extractor.js
/**
 * High-Fidelity Wanderer React-Flow DOM Topology & Edge Extractor
 * Extracts both Solar System Nodes and Directed Wormhole Edges.
 */

export function extractWandererTopology() {
  if (typeof document === 'undefined') {
    return { success: false, error: 'NO_DOCUMENT_AVAILABLE', nodes: [], edges: [] };
  }

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

  const namedSystems = new Set([
    'JITA', 'THERA', 'AMAMAKE', 'POITOT', 'HEK', 'DODIXIE', 'RENS', 'AMARR',
    'RANCER', 'TAMA', 'NIARJA', 'B-R5RB', 'M-OEE8', 'V-3YG7',
    'ORDUIN', 'LOGUTTUR', 'MERCOMESIER', 'ZORORZIH', 'AIKANTOH', 'APANAKE',
    'PAKHSHI', 'KASSIGAINEN', 'LIBERATED BARBICAN', 'BARBICAN', 'VIDETTE',
    'REDOUBT', 'SENTINEL', 'CONFLUX'
  ]);

  function cleanToken(t) {
    return (t || '').trim().replace(/^[\s\-\|\,\;]+|[\s\-\|\,\;]+$/g, '');
  }

  function isOverlayUI(el) {
    if (!el || typeof el.closest !== 'function') return false;
    if (el.classList?.contains('react-flow__node') || el.closest('.react-flow__node') ||
        el.classList?.contains('react-flow__edge') || el.closest('.react-flow__edge')) {
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

  const rawNodes = [];
  const rawEdges = [];
  const nodeById = new Map();
  const nodeByName = new Map();

  // 1. EXTRACT NODES
  for (const root of searchRoots) {
    let nodeContainers = Array.from(root.querySelectorAll(
      '.react-flow__node, [class*="system-node"], [class*="systemNode"], ' +
      '[data-testid*="node"], [data-id*="system"], g.node'
    ));

    for (const container of nodeContainers) {
      if (isOverlayUI(container)) continue;

      const nodeId = container.getAttribute('data-id') || 
                     container.getAttribute('id') || 
                     `node-${rawNodes.length + 1}`;

      // Coordinates
      let posX = 0;
      let posY = 0;
      const style = container.getAttribute('style') || '';
      const transformMatch = style.match(/transform:\s*translate(?:3d)?\(([-0-9.]+)px,\s*([-0-9.]+)px/i);
      if (transformMatch) {
        posX = parseFloat(transformMatch[1]);
        posY = parseFloat(transformMatch[2]);
      }

      // Leaf text tokens
      const allDescendants = Array.from(container.querySelectorAll('*'));
      const leafEls = allDescendants.filter(el => el.children.length === 0);

      const leafTokens = [];
      for (const el of leafEls) {
        const txt = cleanToken(el.textContent);
        if (!txt || txt.length > 30 || /^(zoom|reset|search|filter|\+|\-)$/i.test(txt)) continue;
        leafTokens.push(txt);
      }

      // SVG text
      const svgTexts = Array.from(container.querySelectorAll('text, tspan'))
        .map(el => cleanToken(el.textContent))
        .filter(t => t.length > 0 && t.length < 30);
      for (const t of svgTexts) leafTokens.push(t);

      // Resolve System Name
      let sysName = null;
      for (const t of leafTokens) {
        const clean = t.toUpperCase();
        if (jSpaceRegex.test(clean)) {
          sysName = clean.match(jSpaceRegex)[1].toUpperCase();
          break;
        }
        if (namedSystems.has(clean)) {
          sysName = t;
          break;
        }
        if (isNullsecSystem(clean)) {
          sysName = clean;
          break;
        }
      }

      // K-Space fallback
      if (!sysName) {
        for (const t of leafTokens) {
          const clean = t.toUpperCase();
          if (
            /^[A-Z][a-zA-Z0-9\-\'\s]{2,20}$/.test(t) &&
            !/^(1\.0|0\.[0-9]|-0\.[0-9])$/.test(t) &&
            !classRegex.test(clean) &&
            !threeLetterSigRegex.test(clean) &&
            !cosmicSigFullRegex.test(clean) &&
            !['AND', 'THE', 'FOR', 'OUT', 'NEW', 'SEC', 'MAP', 'SYSTEM', 'NODE'].includes(clean)
          ) {
            sysName = t;
            break;
          }
        }
      }

      if (!sysName) continue;

      const isHome = sysName.toUpperCase() === 'J215758' || 
                     sysName.toUpperCase() === 'J113907' || 
                     container.classList.contains('home') ||
                     container.innerHTML.includes('PG');

      // 3-Letter Signature
      let signature = '-';
      for (const t of leafTokens) {
        const clean = t.toUpperCase();
        if (threeLetterSigRegex.test(clean) && !classRegex.test(clean) && clean !== sysName.toUpperCase()) {
          signature = clean;
          break;
        }
      }

      // Wormhole Class / Security
      let sysClass = '';
      const classTitleEl = container.querySelector?.('[class*="classTitle"]');
      if (classTitleEl) {
        sysClass = cleanToken(classTitleEl.textContent);
      }
      if (!sysClass) {
        for (const t of leafTokens) {
          if (classRegex.test(t)) {
            sysClass = t.toUpperCase();
            break;
          }
          if (/^-?\d+\.\d+$/.test(t)) {
            sysClass = t;
            break;
          }
        }
      }

      // Custom Tag (e.g. PG, A, A1.1, B, D)
      let customTag = isHome ? 'PG' : '-';
      const customTagEl = container.querySelector?.('[class*="classSystemName"]');
      if (customTagEl) {
        const txt = cleanToken(customTagEl.textContent);
        if (txt && txt !== sysName) customTag = txt;
      } else {
        for (const t of leafTokens) {
          if (/^([A-Z]\d*(\.\d+)?|[A-Z]{1,2})$/i.test(t) && t !== signature && t !== sysClass && t !== sysName) {
            customTag = t;
            break;
          }
        }
      }

      // Statics
      const staticEls = Array.from(container.querySelectorAll?.('[class*="eve-wh-type-color"]') || [])
        .filter(el => !el.className.includes('classTitle'));
      const statics = [];
      for (const sEl of staticEls) {
        const txt = cleanToken(sEl.textContent);
        if (txt && !statics.includes(txt.toUpperCase()) && txt !== sysName) {
          statics.push(txt.toUpperCase());
        }
      }

      // Filter out stray mass indicators from statics (e.g. 'L', 'XL', 'M', 'S')
      const cleanStatics = statics.filter(st => !['S', 'M', 'L', 'XL'].includes(st.toUpperCase()));

      // Active Pilots
      let pilots = 0;

      // 1. Direct character / pilot avatar images
      const avatarImgs = Array.from(container.querySelectorAll(
        'img[src*="characters" i], img[src*="portrait" i], img[src*="eveonline" i], img[src*="evetech" i]'
      ));
      if (avatarImgs.length > 0) {
        pilots = Math.max(pilots, avatarImgs.length);
      }

      // 2. CSS background-image character avatars
      const bgAvatars = Array.from(container.querySelectorAll(
        '[style*="characters" i], [style*="portrait" i], [style*="eveonline" i], [style*="evetech" i]'
      ));
      if (bgAvatars.length > 0) {
        pilots = Math.max(pilots, bgAvatars.length);
      }

      // 3. Elements with character or pilot specific classes or data attributes
      const charElements = Array.from(container.querySelectorAll(
        '[data-character-id], [data-pilot-id], [class*="character-avatar" i], [class*="pilot-avatar" i], [class*="pilot-card" i], [class*="characterAvatar" i], [class*="character_avatar" i]'
      ));
      if (charElements.length > 0) {
        pilots = Math.max(pilots, charElements.length);
      }

      // 4. Pilot badge / presence counter elements (excluding kills, zkill, swords, crosshair, sigs)
      if (pilots === 0) {
        const pilotBadges = Array.from(container.querySelectorAll(
          '[class*="pilot" i], [class*="character" i], [class*="user" i], [class*="member" i], [class*="presence" i], [class*="occupant" i], ' +
          '[data-tooltip*="pilot" i], [title*="pilot" i], [aria-label*="pilot" i], [title*="character" i], [title*="member" i]'
        )).filter(el => {
          const cls = (el.className || '').toString().toLowerCase();
          const title = (el.getAttribute('title') || '').toLowerCase();
          const tooltip = (el.getAttribute('data-tooltip') || '').toLowerCase();
          return !cls.includes('kill') && !cls.includes('zkill') && !cls.includes('sig') &&
                 !title.includes('kill') && !title.includes('sig') &&
                 !tooltip.includes('kill') && !tooltip.includes('sig');
        });

        for (const pEl of pilotBadges) {
          const txt = cleanToken(pEl.textContent);
          const numMatch = txt.match(/\b(\d{1,3})\b/);
          if (numMatch) {
            pilots = parseInt(numMatch[1], 10);
            break;
          }
        }
      }

      // 5. SVG User/Person icon with adjacent counter
      if (pilots === 0) {
        const svgs = Array.from(container.querySelectorAll('svg'));
        for (const svg of svgs) {
          const html = svg.innerHTML.toLowerCase();
          const cls = (svg.getAttribute('class') || '').toLowerCase();
          const isUserIcon = cls.includes('user') || cls.includes('pilot') || cls.includes('person') ||
                            (html.includes('circle') && (html.includes('21v-2') || html.includes('user') || html.includes('17 21')));
          if (isUserIcon) {
            const parent = svg.parentElement;
            if (parent) {
              const txt = cleanToken(parent.textContent);
              const numMatch = txt.match(/\b(\d{1,3})\b/);
              if (numMatch) {
                pilots = parseInt(numMatch[1], 10);
                break;
              }
            }
          }
        }
      }

      // 6. Non-kill Leaf token fallback: captures pilot numbers on map nodes while strictly excluding kill / jump / sig badges
      if (pilots === 0) {
        for (const el of leafEls) {
          const isKillOrJumpOrSig = el.closest?.(
            '[class*="kill" i], [class*="zkill" i], [title*="kill" i], [data-tooltip*="kill" i], ' +
            '[class*="danger" i], [class*="destructive" i], [class*="red" i], [class*="sword" i], [class*="crosshair" i], ' +
            '[class*="jump" i], [title*="jump" i], [data-tooltip*="jump" i], ' +
            '[class*="sig" i], [title*="sig" i], [data-tooltip*="sig" i], ' +
            '[class*="classTitle" i], [class*="eve-wh-type-color" i]'
          );
          if (isKillOrJumpOrSig) continue;

          const txt = cleanToken(el.textContent);
          if (/^\d{1,3}$/.test(txt) && txt !== '0' && txt !== sysClass && txt !== signature && !['S', 'M', 'L', 'XL'].includes(txt)) {
            pilots = parseInt(txt, 10);
            break;
          }
        }
      }

      const nodeObj = {
        id: nodeId,
        name: sysName,
        signature: signature,
        class: sysClass || (sysName.startsWith('J') ? 'WH' : 'K-Space'),
        tag: customTag,
        statics: cleanStatics,
        pilots: pilots,
        is_home: isHome,
        x: posX,
        y: posY,
      };

      rawNodes.push(nodeObj);
      nodeById.set(nodeId, nodeObj);
      nodeByName.set(sysName.toUpperCase(), nodeObj);
      if (customTag !== '-') nodeByName.set(customTag.toUpperCase(), nodeObj);
    }
  }

  // 2. EXTRACT EDGES
  for (const root of searchRoots) {
    const edgeContainers = Array.from(root.querySelectorAll(
      '.react-flow__edge, [class*="react-flow__edge"], g[class*="edge"]'
    ));

    for (const edgeEl of edgeContainers) {
      const edgeId = edgeEl.getAttribute('data-testid') || 
                     edgeEl.getAttribute('id') || 
                     edgeEl.getAttribute('aria-label') || '';

      let source = edgeEl.getAttribute('data-source') || '';
      let target = edgeEl.getAttribute('data-target') || '';

      // Support Wanderer React Flow edge formats:
      // e.g. "rf__edge-31001342_30000118" or "reactflow__edge-node1-node2"
      if ((!source || !target) && edgeId) {
        const cleanEdgeId = edgeId.replace(/^(?:reactflow__edge-|rf__edge-)/i, '');
        if (cleanEdgeId.includes('_')) {
          const parts = cleanEdgeId.split('_');
          source = parts[0];
          target = parts.slice(1).join('_');
        } else if (cleanEdgeId.includes('-')) {
          const parts = cleanEdgeId.split('-');
          source = parts[0];
          target = parts.slice(1).join('-');
        }
      }

      // If source or target is still unknown, skip container
      if (!source || !target || source === 'unknown' || target === 'unknown') {
        continue;
      }

      // Wormhole Mass indicator (M, L, XL, S) from text badge
      let mass = 'L';
      const labelEl = edgeEl.querySelector?.('.react-flow__edge-text, text, [class*="edge-text"], [class*="badge"]');
      if (labelEl) {
        const lbl = cleanToken(labelEl.textContent).toUpperCase();
        if (['S', 'M', 'L', 'XL'].includes(lbl)) {
          mass = lbl;
        }
      }

      // Stroke color & Life/Mass status
      const pathEl = edgeEl.querySelector?.('path');
      let strokeColor = '#38bdf8';
      let timeStatus = 'stable';
      let massStatus = 'stable';

      if (pathEl) {
        const stroke = pathEl.getAttribute('stroke') || window.getComputedStyle(pathEl).stroke;
        if (stroke) strokeColor = stroke;
      }

      if (strokeColor.includes('239, 68, 68') || strokeColor === '#ef4444' || strokeColor.includes('red')) {
        timeStatus = 'eol';
      }

      rawEdges.push({
        id: edgeId || `edge-${source}-${target}`,
        source: source,
        target: target,
        mass: mass,
        time_status: timeStatus,
        mass_status: massStatus,
        color: strokeColor,
      });
    }
  }

  return {
    success: rawNodes.length > 0,
    timestamp: new Date().toISOString(),
    source_app: 'Wanderer',
    nodes: rawNodes,
    edges: rawEdges,
    nodeCount: rawNodes.length,
    edgeCount: rawEdges.length,
  };
}

if (typeof window !== 'undefined') {
  window.extractWandererTopology = extractWandererTopology;
}
