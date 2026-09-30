// lib/chain-crossref.js

/**
 * Cross-references zKillboard activity against cached Wanderer wormhole chain topology.
 * Handles Active Staleness Guards (>30 min check) and proximity hop calculations.
 */

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

/**
 * Retrieves cached Wanderer chain data from chrome.storage.local.
 */
export async function getCachedWandererChain() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return { chain: null, timestamp: 0 };
  }
  return new Promise((resolve) => {
    chrome.storage.local.get(['wandererChainTopology', 'wandererChainTimestamp'], (result) => {
      resolve({
        chain: result.wandererChainTopology || null,
        timestamp: result.wandererChainTimestamp || 0
      });
    });
  });
}

/**
 * Saves active Wanderer chain topology to chrome.storage.local with timestamp.
 */
export async function saveWandererChain(chainNodes) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  const now = Date.now();
  return new Promise((resolve) => {
    chrome.storage.local.set({
      wandererChainTopology: chainNodes,
      wandererChainTimestamp: now
    }, () => resolve(true));
  });
}

const DEFAULT_HOME_SYSTEM = 'J215758';

/**
 * Calculates hop distance from Home system across known chain connections.
 */
function calculateHops(targetSystem, chainNodes) {
  if (!chainNodes || !Array.isArray(chainNodes)) return -1;
  const upperTarget = (targetSystem || '').toUpperCase();

  // Explicit Home system check
  if (upperTarget === DEFAULT_HOME_SYSTEM || upperTarget === 'J113907') {
    return 0;
  }

  // Find target node in chain
  const targetNode = chainNodes.find(n => (n.system || n.name || '').toUpperCase() === upperTarget);
  if (!targetNode) return -1;

  // Check if target is Home by tag or property
  if (
    targetNode.isHome || 
    targetNode.tag === 'PG' || 
    (targetNode.tags && /home|pg/i.test(targetNode.tags))
  ) {
    return 0;
  }

  // If node has explicit hops or distance property
  if (typeof targetNode.hops === 'number') return targetNode.hops;
  if (typeof targetNode.distance === 'number') return targetNode.distance;

  // Fallback: estimate from depth if present
  if (typeof targetNode.depth === 'number') return targetNode.depth;

  return 1; // Default to adjacent if node is present in chain
}

/**
 * Cross-references target systems from zKill against active chain.
 *
 * @param {Array<string>} targetSystems - Solar systems where target was active
 * @param {Array<Object>} recentEvents - List of recent kills/losses
 * @returns {Promise<Object>} Cross-reference result with threat rating and staleness
 */
export async function crossReferenceTargetWithChain(targetSystems = [], recentEvents = []) {
  const { chain, timestamp } = await getCachedWandererChain();
  const now = Date.now();

  const chainAgeMs = timestamp ? (now - timestamp) : null;
  const chainAgeMinutes = chainAgeMs ? Math.round(chainAgeMs / 60000) : null;
  const isStale = chainAgeMs ? (chainAgeMs > THIRTY_MINUTES_MS) : true;

  if (!chain || !Array.isArray(chain) || chain.length === 0) {
    return {
      hasChainData: false,
      isStale: true,
      chainAgeMinutes: null,
      stalenessWarning: 'NO_CHAIN_DATA_CACHED',
      hasIntersection: false,
      highestThreatLevel: 'NONE',
      hotSystems: [],
      matchedEvents: []
    };
  }

  const DRIFTER_HIVES = ['BARBICAN', 'VIDETTE', 'REDOUBT', 'SENTINEL', 'CONFLUX'];

  // Target match helper across name, tag, or Drifter Hive string
  function matchesSystemOrTag(node, targetSys) {
    if (!targetSys) return false;
    const targetUpper = targetSys.trim().toUpperCase();
    const nodeSys = (node.system || node.name || '').trim().toUpperCase();
    const nodeTagRaw = (node.tags || node.tag || '').trim().toUpperCase();

    // 1. Exact system name match
    if (nodeSys && nodeSys !== '-' && nodeSys === targetUpper) return true;

    // 2. Exact match against individual comma-separated tags
    if (nodeTagRaw) {
      const splitTags = nodeTagRaw.split(/[,;]/).map(t => t.trim()).filter(Boolean);
      if (splitTags.some(t => t === targetUpper)) return true;
    }

    // 3. Drifter Hive matching (e.g. Liberated Barbican <-> Barbican)
    for (const hive of DRIFTER_HIVES) {
      if (targetUpper.includes(hive)) {
        if (nodeSys.includes(hive) || nodeTagRaw.includes(hive)) return true;
      }
    }

    return false;
  }

  const hotSystems = [];
  const matchedEvents = [];

  targetSystems.forEach(sys => {
    const upperSys = sys.toUpperCase();
    const matchedNode = chain.find(n => matchesSystemOrTag(n, upperSys));

    if (matchedNode) {
      const hops = calculateHops(matchedNode.system || matchedNode.name || upperSys, chain);
      const eventsInSys = recentEvents.filter(e => {
        const evSys = (e.solarSystem || '').toUpperCase();
        return evSys === upperSys || (DRIFTER_HIVES.some(h => evSys.includes(h) && upperSys.includes(h)));
      });

      hotSystems.push({
        system: sys,
        hops,
        killCount: eventsInSys.length || 1,
        latestTimeAgo: eventsInSys[0]?.timestamp?.timeAgo || 'Recent'
      });

      matchedEvents.push(...eventsInSys);
    }
  });

  // Determine threat severity based on minimum hop distance
  let highestThreatLevel = 'NONE';
  let minHops = 999;

  if (hotSystems.length > 0) {
    hotSystems.forEach(h => {
      if (h.hops >= 0 && h.hops < minHops) minHops = h.hops;
    });

    if (minHops === 0) {
      highestThreatLevel = 'CRITICAL_HOME';
    } else if (minHops === 1) {
      highestThreatLevel = 'CRITICAL'; // 1 hop from Home
    } else if (minHops === 2) {
      highestThreatLevel = 'ELEVATED'; // 2 hops from Home
    } else {
      highestThreatLevel = 'ADVISORY'; // 3+ hops from Home
    }
  }

  return {
    hasChainData: true,
    isStale,
    chainAgeMinutes,
    stalenessWarning: isStale ? `Chain data is ${chainAgeMinutes}m old` : null,
    hasIntersection: hotSystems.length > 0,
    highestThreatLevel,
    minHops: minHops === 999 ? -1 : minHops,
    hotSystems,
    matchedEvents
  };
}
