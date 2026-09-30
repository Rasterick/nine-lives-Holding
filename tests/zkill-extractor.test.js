// tests/zkill-extractor.test.js
import { extractZkillData } from '../content/zkill-extractor.js';
import { crossReferenceTargetWithChain, saveWandererChain } from '../lib/chain-crossref.js';
import { classifyZkillThreatHeuristically } from '../lib/ai.js';
import { formatDiscordFlashReport, formatZkillData } from '../lib/formatters.js';

console.log('--- RUNNING ZKILL TACTICAL EXTRACTOR & CHAIN CORRELATION TEST ---');

// 1. Build minimal DOM mocks matching sandbox/test-zkill.html
function createMockEl(tagName, attrs = {}, textContent = '', children = []) {
  const el = {
    tagName: tagName.toUpperCase(),
    textContent,
    className: attrs.class || '',
    children: [...children],
    getAttribute: (name) => attrs[name] || null,
    querySelector: (selector) => {
      let found = null;
      function walk(node) {
        if (found) return;
        for (const child of node.children) {
          if (matchesSelector(child, selector)) {
            found = child;
            return;
          }
          walk(child);
        }
      }
      walk(el);
      return found;
    },
    querySelectorAll: (selector) => {
      const results = [];
      function walk(node) {
        for (const child of node.children) {
          if (matchesSelector(child, selector)) {
            results.push(child);
          }
          walk(child);
        }
      }
      walk(el);
      return results;
    }
  };
  return el;
}

function matchesSelector(node, selector) {
  if (selector.startsWith('.')) {
    const cls = selector.substring(1);
    return node.className.split(' ').includes(cls);
  }
  if (selector.includes('href*=')) {
    const pattern = selector.match(/href\*=['"]?([^'"]+)['"]?/)?.[1];
    return node.tagName === 'A' && (node.getAttribute('href') || '').includes(pattern);
  }
  if (selector.startsWith('img[')) {
    return node.tagName === 'IMG';
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

// Build Mock Rows for Pilot Profile
const kill1 = createMockEl('tr', { class: 'kill' }, '', [
  createMockEl('a', { href: '/kill/120994101/' }, '#120994101'),
  createMockEl('a', { href: '/system/31001429/' }, 'J142923'),
  createMockEl('a', { href: '/ship/17476/' }, 'Covetor'),
  createMockEl('a', { href: '/character/95432101/' }, 'Mining Scout 01'),
  createMockEl('td', { 'data-timestamp': new Date(Date.now() - 18 * 60000).toISOString() }, '18m ago')
]);

const kill2 = createMockEl('tr', { class: 'kill' }, '', [
  createMockEl('a', { href: '/kill/120993950/' }, '#120993950'),
  createMockEl('a', { href: '/system/31001429/' }, 'J142923'),
  createMockEl('a', { href: '/ship/605/' }, 'Heron'),
  createMockEl('a', { href: '/character/95432102/' }, 'Relic Hunter'),
  createMockEl('td', { 'data-timestamp': new Date(Date.now() - 32 * 60000).toISOString() }, '32m ago')
]);

const loss1 = createMockEl('tr', { class: 'loss' }, '', [
  createMockEl('a', { href: '/kill/120991200/' }, '#120991200'),
  createMockEl('a', { href: '/system/30002187/' }, 'Amamake'),
  createMockEl('a', { href: '/ship/29988/' }, 'Proteus'),
  createMockEl('a', { href: '/character/2114758784/' }, 'Mitch Caldera'),
  createMockEl('td', { 'data-timestamp': new Date(Date.now() - 3 * 3600000).toISOString() }, '3h ago')
]);

const mockDoc = {
  title: 'Mitch Caldera | Character | zKillboard',
  location: { href: 'https://zkillboard.com/character/2114758784/', pathname: '/character/2114758784/' },
  querySelector: (sel) => {
    if (sel === 'h1') return createMockEl('h1', {}, 'Mitch Caldera');
    if (sel.includes('/corporation/')) return createMockEl('a', { href: '/corporation/98654321/' }, 'Black Flag Syndicate');
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel.includes('tr')) return [kill1, kill2, loss1];
    return [];
  }
};

// --- TEST 1: Extract zKill Profile Data ---
console.log('--- TEST 1: PROFILE EXTRACTION ---');
const extracted = await extractZkillData(mockDoc);

if (!extracted.success) {
  throw new Error(`Extraction failed: ${extracted.error}`);
}

console.log(`[TEST] Target: ${extracted.entityName} (${extracted.entityType} ID: ${extracted.entityId})`);
console.log(`[TEST] Corp: ${extracted.entityCorp} (ID: ${extracted.entityCorpId})`);
console.log(`[TEST] Systems: ${extracted.uniqueSystems.join(', ')}`);
console.log(`[TEST] Ships: ${extracted.shipsObserved.join(', ')}`);

if (extracted.entityName !== 'Mitch Caldera' || extracted.entityId !== 2114758784) {
  throw new Error(`Entity identity mismatch: ${extracted.entityName} ID ${extracted.entityId}`);
}

if (!extracted.uniqueSystems.includes('J142923') || !extracted.uniqueSystems.includes('Amamake')) {
  throw new Error(`Systems mismatch: ${JSON.stringify(extracted.uniqueSystems)}`);
}

console.log('✅ Test 1 PASSED: Profile extraction successful.');

// --- TEST 2: Chain Cross-Referencing & Proximity Alert ---
console.log('--- TEST 2: CHAIN CROSS-REFERENCING ---');

// Mock chrome.storage.local
const mockStorage = {
  wandererChainTopology: [
    { system: 'J113907', class: 'C5', isHome: true, hops: 0 },
    { system: 'J142923', class: 'C4', hops: 1 },
    { system: 'J215758', class: 'C4', hops: 2 }
  ],
  wandererChainTimestamp: Date.now() - 10 * 60000 // 10 minutes ago (Fresh)
};

globalThis.chrome = {
  storage: {
    local: {
      get: (keys, cb) => cb(mockStorage),
      set: (data, cb) => { Object.assign(mockStorage, data); if (cb) cb(); }
    }
  }
};

const crossRef = await crossReferenceTargetWithChain(extracted.uniqueSystems, extracted.recentEvents);

console.log(`[TEST] Has Chain Intersection: ${crossRef.hasIntersection}`);
console.log(`[TEST] Highest Threat Level: ${crossRef.highestThreatLevel}`);
console.log(`[TEST] Minimum Hops: ${crossRef.minHops}`);
console.log(`[TEST] Hot Systems:`, crossRef.hotSystems);

if (!crossRef.hasIntersection) {
  throw new Error('Expected chain intersection with J142923!');
}

if (crossRef.highestThreatLevel !== 'CRITICAL' || crossRef.minHops !== 1) {
  throw new Error(`Expected CRITICAL threat at 1 hop from Home! Got ${crossRef.highestThreatLevel} (${crossRef.minHops} hops)`);
}

if (crossRef.isStale) {
  throw new Error('Chain data should be fresh (<30m)!');
}

console.log('✅ Test 2 PASSED: Chain cross-referencing accurately flagged 1 hop threat!');

// --- TEST 3: Heuristic Threat Synthesis ---
console.log('--- TEST 3: HEURISTIC THREAT SYNTHESIS ---');
const threatSynthesis = classifyZkillThreatHeuristically({
  shipsObserved: ['Proteus', 'Sabre', 'Loki'],
  gangCount: 3,
  sampleCount: 3,
  killsCount: 2,
  lossesCount: 1
});

console.log(`[TEST] Threat Index: ${threatSynthesis.threatIndex}/10`);
console.log(`[TEST] Doctrine: ${threatSynthesis.doctrine}`);
console.log(`[TEST] Precaution: ${threatSynthesis.precautions[0]}`);

if (threatSynthesis.threatIndex < 7) {
  throw new Error(`Expected threat index >= 7 for T3C + Sabre gang! Got ${threatSynthesis.threatIndex}`);
}

if (!threatSynthesis.doctrine.includes('Heavy Armor T3C Brawl')) {
  throw new Error(`Expected T3C Brawl doctrine! Got ${threatSynthesis.doctrine}`);
}

console.log('✅ Test 3 PASSED: Threat synthesis correctly classified doctrine & precautions.');

// --- TEST 4: Flash Discord Report & JSON Formatting ---
console.log('--- TEST 4: DISCORD FLASH & JSON FORMATTING ---');
const discordReport = formatDiscordFlashReport(extracted, threatSynthesis, crossRef);
console.log('Generated Discord Flash Report:\n----------------------------------\n' + discordReport);

if (!discordReport.includes('AURA TACTICAL FLASH') || !discordReport.includes('1 HOP FROM HOME')) {
  throw new Error('Discord report missing critical flash alert or proximity warning!');
}

const jsonOutput = formatZkillData(extracted, threatSynthesis, crossRef, 'json');
const parsedJson = JSON.parse(jsonOutput);

if (parsedJson.source !== 'zkillboard' || parsedJson.entity.name !== 'Mitch Caldera') {
  throw new Error('JSON output schema validation failed!');
}

console.log('✅ Test 4 PASSED: Discord flash and JSON output valid.');

console.log('\n🎉 ALL PHASE 1 EXTRACTOR & CHAIN CORRELATION TESTS PASSED COMPLETELY!\n');
