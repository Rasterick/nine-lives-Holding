// tests/pilots-extractor.test.js
import { extractWandererPilots, extractWandererPilotsFromHtml } from '../content/pilots-extractor.js';

console.log('--- Testing extractWandererPilots & extractWandererPilotsFromHtml ---');

// Mock HTML matching Wanderer DOM with Signatures, Structures, Routes, and Local panels
const mockMultiPanelHtml = `
<!DOCTYPE html>
<html>
<head><title>Wanderer - C4 J215758</title></head>
<body>
  <div class="sidebar">
    <!-- Signatures Panel -->
    <div class="panel signatures-panel">
      <div class="header">
        <span>[6]</span>
        <span>Signatures in</span>
        <span class="badge">C4</span>
        <span>J215758</span>
      </div>
      <table>
        <thead><tr><th>Id</th><th>Group</th><th>Info</th><th>Description</th><th>Added</th><th>Updated</th><th>Character</th></tr></thead>
        <tbody>
          <tr>
            <td>BSG-714</td>
            <td>Wormhole</td>
            <td>A C247 C3 J172701</td>
            <td></td>
            <td>0 11:17:55</td>
            <td>0 02:09:12</td>
            <td>Dentin Ename</td>
            <td><img src="/icons/brackets/wormhole.png"/></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Routes Panel -->
    <div class="panel routes-panel">
      <table>
        <tbody>
          <tr>
            <td>0.6 Korsiki 7 0.6 Wuos 8</td>
            <td><img src="images/30747_64.png"/></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Structures Panel -->
    <div class="panel structures-panel">
      <table>
        <thead><tr><th>Type</th><th>Name</th><th>Owner</th><th>Status</th><th>Timer</th></tr></thead>
        <tbody>
          <tr>
            <td>Fortizar</td>
            <td>Silent Anchorage</td>
            <td>CCHG</td>
            <td>Powered</td>
            <td><img src="https://images.evetech.net/types/35833/icon"/></td>
          </tr>
          <tr>
            <td>Raitaru</td>
            <td>Keelworks</td>
            <td>CCHG</td>
            <td>Powered</td>
            <td><img src="https://images.evetech.net/types/35825/icon"/></td>
          </tr>
          <tr>
            <td>Athanor</td>
            <td>Stillhouse</td>
            <td>CCHG</td>
            <td>Powered</td>
            <td><img src="https://images.evetech.net/types/35835/icon"/></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Local [3] Panel -->
    <div class="panel local-panel">
      <div class="panel-header">
        <span class="title">Local [3]</span>
        <span>Ship name [x] =</span>
      </div>
      <div class="panel-body">
        <div class="pilot-row">
          <div class="pilot-portrait">
            <img src="https://images.evetech.net/characters/95000001/portrait?size=64" alt="Chrysabelle Ellecon" />
          </div>
          <div class="pilot-info">
            <div class="pilot-name">Chrysabelle Ellecon [AP.MC]</div>
            <div class="pilot-ship">
              <span class="ship-name">Capsule - Chrysa...</span>
              <img class="ship-icon" src="https://images.evetech.net/types/670/icon" title="Capsule" alt="Capsule" />
            </div>
          </div>
        </div>

        <div class="pilot-row">
          <div class="pilot-portrait">
            <img src="https://images.evetech.net/characters/95000003/portrait?size=64" alt="Shuma" />
          </div>
          <div class="pilot-info">
            <div class="pilot-name">Shuma [AP.MC]</div>
            <div class="pilot-ship">
              <span class="ship-name">Never Talk To Str...</span>
              <img class="ship-icon" src="https://images.evetech.net/types/11174/icon" title="Hound" alt="Hound" />
            </div>
          </div>
        </div>

        <div class="pilot-row">
          <div class="pilot-portrait">
            <img src="https://images.evetech.net/characters/95000002/portrait?size=64" alt="Ultimate Pikie" />
          </div>
          <div class="pilot-info">
            <div class="pilot-name">Ultimate Pikie [AP.MC]</div>
            <div class="pilot-ship">
              <span class="ship-name">Into the Breach</span>
              <img class="ship-icon" src="https://images.evetech.net/types/11377/icon" title="Nemesis" alt="Nemesis" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

// 1. Test HTML extraction with multi-panel clutter
const result = extractWandererPilotsFromHtml(mockMultiPanelHtml);

if (!result.success) {
  throw new Error(`Extraction failed: ${result.error || result.message}`);
}

if (result.system !== 'J215758') {
  throw new Error(`Expected system "J215758", got "${result.system}"`);
}
if (result.class !== 'C4') {
  throw new Error(`Expected class "C4", got "${result.class}"`);
}
if (result.count !== 3 || result.pilots.length !== 3) {
  throw new Error(`Expected 3 pilots, got ${result.pilots.length}`);
}

// Ensure NO structures, routes, or signatures were captured
for (const p of result.pilots) {
  if (/Fortizar|Raitaru|Athanor|BSG|Wormhole|Korsiki/i.test(p.pilot) ||
      /Fortizar|Raitaru|Athanor|BSG|Wormhole|Korsiki/i.test(p.shipName)) {
    throw new Error(`Extracted non-pilot row as pilot! Row: ${JSON.stringify(p)}`);
  }
}

const p1 = result.pilots[0];
if (p1.pilot !== 'Chrysabelle Ellecon' || p1.corp !== 'AP.MC' || p1.shipName !== 'Capsule - Chrysa...' || p1.shipType !== 'Capsule') {
  throw new Error(`Pilot 1 incorrect: ${JSON.stringify(p1)}`);
}

const p2 = result.pilots[1];
if (p2.pilot !== 'Shuma' || p2.corp !== 'AP.MC' || p2.shipName !== 'Never Talk To Str...' || p2.shipType !== 'Hound') {
  throw new Error(`Pilot 2 incorrect: ${JSON.stringify(p2)}`);
}

const p3 = result.pilots[2];
if (p3.pilot !== 'Ultimate Pikie' || p3.corp !== 'AP.MC' || p3.shipName !== 'Into the Breach' || p3.shipType !== 'Nemesis') {
  throw new Error(`Pilot 3 incorrect: ${JSON.stringify(p3)}`);
}

// 2. Test Edge case: No Local panel in HTML
const emptyResult = extractWandererPilotsFromHtml('<div>Empty Page</div>');
if (emptyResult.success) {
  throw new Error('Expected failure on page without Local panel');
}

// 2b. Test Local [0] empty/clear state with multi-panel clutter
const clearLocalHtml = `
  <div class="panel signatures-panel">
    <div class="header">Signatures in C4 J215758</div>
    <table><tr><td>BSG-714</td><td>Wormhole</td><td>A C247 C3 J172701</td><td><img src="/icons/brackets/wormhole.png"/></td></tr></table>
  </div>
  <div class="panel structures-panel">
    <table><tr><td>Fortizar</td><td><img src="https://images.evetech.net/types/35833/icon"/></td></tr></table>
  </div>
  <div class="panel local-panel">
    <div class="panel-header"><span class="title">Local [0]</span></div>
    <div class="panel-body">No pilots active</div>
  </div>
`;
const clearResult = extractWandererPilotsFromHtml(clearLocalHtml);
if (!clearResult.success || clearResult.count !== 0 || clearResult.pilots.length !== 0) {
  throw new Error(`Expected 0 pilots on Local [0], got ${JSON.stringify(clearResult)}`);
}
if (clearResult.system !== 'J215758' || clearResult.class !== 'C4') {
  throw new Error(`Expected J215758 (C4), got ${clearResult.system} (${clearResult.class})`);
}

// 3. Test null doc handling in extractWandererPilots
const nullDocResult = extractWandererPilots(null);
if (nullDocResult.success || nullDocResult.error !== 'NO_DOCUMENT_AVAILABLE') {
  throw new Error('Expected NO_DOCUMENT_AVAILABLE on null doc');
}

// 4. Test Mock Document handling with multi-panel tree
const mockDoc = {
  title: 'Wanderer - C4 J215758',
  querySelectorAll(sel) {
    if (sel === 'iframe') return [];
    if (sel === '*') {
      const localCard = {
        querySelectorAll(sub) {
          if (sub.includes('character') || sub === 'img') {
            return [
              {
                getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/95000001/portrait?size=64' : null,
                parentElement: {
                  closest: () => null,
                  querySelector: () => null,
                  querySelectorAll: (q) => q === 'img' ? [
                    { getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/95000001/portrait?size=64' : null },
                    { getAttribute: (a) => a === 'title' ? 'Capsule' : null, closest: () => null }
                  ] : [],
                  textContent: 'Chrysabelle Ellecon [AP.MC] Capsule - Chrysa...',
                  parentElement: { querySelectorAll: () => [{}] }
                }
              },
              {
                getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/95000003/portrait?size=64' : null,
                parentElement: {
                  closest: () => null,
                  querySelector: () => null,
                  querySelectorAll: (q) => q === 'img' ? [
                    { getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/95000003/portrait?size=64' : null },
                    { getAttribute: (a) => a === 'title' ? 'Hound' : null, closest: () => null }
                  ] : [],
                  textContent: 'Shuma [AP.MC] Never Talk To Str...',
                  parentElement: { querySelectorAll: () => [{}] }
                }
              },
              {
                getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/95000002/portrait?size=64' : null,
                parentElement: {
                  closest: () => null,
                  querySelector: () => null,
                  querySelectorAll: (q) => q === 'img' ? [
                    { getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/95000002/portrait?size=64' : null },
                    { getAttribute: (a) => a === 'title' ? 'Nemesis' : null, closest: () => null }
                  ] : [],
                  textContent: 'Ultimate Pikie [AP.MC] Into the Breach',
                  parentElement: { querySelectorAll: () => [{}] }
                }
              }
            ];
          }
          return [];
        }
      };

      return [
        {
          textContent: 'Signatures in C4 J215758',
          childNodes: [{ nodeType: 3, nodeValue: 'Signatures in C4 J215758' }]
        },
        {
          textContent: 'Local [3]',
          childNodes: [{ nodeType: 3, nodeValue: 'Local [3]' }],
          parentElement: localCard
        }
      ];
    }
    return [];
  },
  querySelector() {
    return null;
  }
};

const domResult = extractWandererPilots(mockDoc);
if (!domResult.success || domResult.pilots.length !== 3) {
  throw new Error(`DOM Walker Extraction failed: ${JSON.stringify(domResult)}`);
}
if (domResult.system !== 'J215758' || domResult.class !== 'C4') {
  throw new Error(`DOM Walker System mismatch: ${domResult.system} (${domResult.class})`);
}
if (domResult.pilots[0].pilot !== 'Chrysabelle Ellecon' || domResult.pilots[1].pilot !== 'Shuma' || domResult.pilots[2].shipType !== 'Nemesis') {
  throw new Error(`DOM Walker Pilot parsing mismatch: ${JSON.stringify(domResult.pilots)}`);
}

// Test case for live user case: spaced corp tickers [ AP.MC ]
const spacedMockDoc = {
  title: 'Wanderer - J215758 (C4)',
  body: {},
  querySelectorAll(sel) {
    if (sel === '*') {
      const localCard = {
        tagName: 'DIV',
        className: 'panel local-panel',
        parentElement: null,
        querySelectorAll(q) {
          if (q === '*') {
            return [
              {
                tagName: 'DIV',
                textContent: 'Mercy Creed [ AP.MC ]',
                parentElement: null,
                querySelectorAll: () => []
              },
              {
                tagName: 'DIV',
                textContent: 'Victor Rizzo [ AP.MC ]',
                parentElement: null,
                querySelectorAll: () => []
              }
            ];
          }
          return [];
        }
      };
      return [
        {
          textContent: 'Local [2]',
          parentElement: localCard
        }
      ];
    }
    return [];
  },
  querySelector() {
    return null;
  }
};

const spacedResult = extractWandererPilots(spacedMockDoc);
if (!spacedResult.success || spacedResult.pilots.length !== 2) {
  throw new Error(`Spaced corp extraction failed: ${JSON.stringify(spacedResult)}`);
}
if (spacedResult.pilots[0].pilot !== 'Mercy Creed' || spacedResult.pilots[0].corp !== 'AP.MC') {
  throw new Error(`Spaced pilot 1 mismatch: ${JSON.stringify(spacedResult.pilots[0])}`);
}
if (spacedResult.pilots[1].pilot !== 'Victor Rizzo' || spacedResult.pilots[1].corp !== 'AP.MC') {
  throw new Error(`Spaced pilot 2 mismatch: ${JSON.stringify(spacedResult.pilots[1])}`);
}

// Test case 3: Live Wanderer pilot rows with ship hulls, tags, and portrait alt tags (prevent duplicate names)
const liveMockDoc = {
  title: 'Wanderer - J215758 (C4)',
  body: {},
  querySelectorAll(sel) {
    if (sel === '*') {
      const row1 = {
        tagName: 'DIV',
        className: 'pilot-row',
        textContent: 'Mercy Creed [ AP.MC ] Occator',
        querySelectorAll(q) {
          if (q === 'img') {
            return [
              { tagName: 'IMG', getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/94656274/portrait' : (a === 'alt' ? 'Mercy Creed' : null) },
              { tagName: 'IMG', getAttribute: (a) => a === 'title' ? 'Occator' : (a === 'src' ? 'https://images.evetech.net/types/12745/icon' : null), closest: () => null }
            ];
          }
          if (q.includes('title')) {
            return [
              { getAttribute: (a) => a === 'title' ? 'Mercy Creed' : null },
              { getAttribute: (a) => a === 'title' ? 'Occator' : null, closest: () => null }
            ];
          }
          return [];
        }
      };

      const row2 = {
        tagName: 'DIV',
        className: 'pilot-row',
        textContent: 'Michiko Yukiko [ AP.MC ] Mission runer',
        querySelectorAll(q) {
          if (q === 'img') {
            return [
              { tagName: 'IMG', getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/2123051982/portrait' : (a === 'alt' ? 'Michiko Yukiko' : null) },
              { tagName: 'IMG', getAttribute: (a) => a === 'title' ? 'Tengu' : (a === 'src' ? 'https://images.evetech.net/types/29984/icon' : null), closest: () => null }
            ];
          }
          if (q.includes('title')) {
            return [
              { getAttribute: (a) => a === 'title' ? 'Michiko Yukiko' : null },
              { getAttribute: (a) => a === 'title' ? 'Tengu' : null, closest: () => null }
            ];
          }
          return [];
        }
      };

      const row3 = {
        tagName: 'DIV',
        className: 'pilot-row',
        textContent: 'Victor Rizzo [ AP.MC ] Capsule -',
        querySelectorAll(q) {
          if (q === 'img') {
            return [
              { tagName: 'IMG', getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/95727715/portrait' : (a === 'alt' ? 'Victor Rizzo' : null) },
              { tagName: 'IMG', getAttribute: (a) => a === 'title' ? 'Capsule' : (a === 'src' ? 'https://images.evetech.net/types/670/icon' : null), closest: () => null }
            ];
          }
          if (q.includes('title')) {
            return [
              { getAttribute: (a) => a === 'title' ? 'Victor Rizzo' : null },
              { getAttribute: (a) => a === 'title' ? 'Capsule' : null, closest: () => null }
            ];
          }
          return [];
        }
      };

      const localCard = {
        tagName: 'DIV',
        className: 'panel local-panel',
        parentElement: null,
        querySelectorAll(q) {
          if (q === '*') return [row1, row2, row3];
          return [];
        }
      };

      return [
        {
          textContent: 'Local [3]',
          parentElement: localCard
        }
      ];
    }
    return [];
  },
  querySelector() {
    return null;
  }
};

const liveResult = extractWandererPilots(liveMockDoc);
if (!liveResult.success || liveResult.pilots.length !== 3) {
  throw new Error(`Live mock extraction failed: ${JSON.stringify(liveResult)}`);
}

// Check Mercy Creed: shipName should default to 'Occator' if untagged, shipType should be 'Occator'
const pMercy = liveResult.pilots[0];
if (pMercy.pilot !== 'Mercy Creed' || pMercy.corp !== 'AP.MC' || pMercy.shipName !== 'Occator' || pMercy.shipType !== 'Occator') {
  throw new Error(`Mercy Creed mismatch: ${JSON.stringify(pMercy)}`);
}

// Check Michiko Yukiko: shipName should be 'Mission runer', shipType should be 'Tengu'
const pMichiko = liveResult.pilots[1];
if (pMichiko.pilot !== 'Michiko Yukiko' || pMichiko.corp !== 'AP.MC' || pMichiko.shipName !== 'Mission runer' || pMichiko.shipType !== 'Tengu') {
  throw new Error(`Michiko Yukiko mismatch: ${JSON.stringify(pMichiko)}`);
}

// Check Victor Rizzo: shipName should be 'Capsule' (trailing dash stripped), shipType should be 'Capsule'
const pVictor = liveResult.pilots[2];
if (pVictor.pilot !== 'Victor Rizzo' || pVictor.corp !== 'AP.MC' || pVictor.shipName !== 'Capsule' || pVictor.shipType !== 'Capsule') {
  throw new Error(`Victor Rizzo mismatch: ${JSON.stringify(pVictor)}`);
}

// Test case 4: Full User Scenario (6 pilots: Abon Riff, Mercy Creed, Salva Coline, Tyrom Hir, Victor Rizzo, Yukiko Yuuki)
const sixPilotsDoc = {
  title: 'Wanderer - J215758 (C4)',
  body: {},
  querySelectorAll(sel) {
    if (sel === '*') {
      const pilotsData = [
        { name: 'Abon Riff', corp: 'AP.MC', text: 'Abon Riff [ AP.MC ] ☜☠☞ Palliser', charId: 92029163, typeId: 33470, expectedType: 'Stratios', expectedName: '☜☠☞ Palliser' },
        { name: 'Mercy Creed', corp: 'AP.MC', text: 'Mercy Creed [ AP.MC ] Occator', charId: 94656274, typeId: 12745, expectedType: 'Occator', expectedName: 'Occator' },
        { name: 'Salva Coline', corp: 'AP.MC', text: 'Salva Coline [ AP.MC ] ☜☠☞ Tapir', charId: 92996645, typeId: 33468, expectedType: 'Astero', expectedName: '☜☠☞ Tapir' },
        { name: 'Tyrom Hir', corp: 'AP.MC', text: 'Tyrom Hir [ AP.MC ] ☜☠☞ Vindictive', charId: 1906220295, typeId: 33470, expectedType: 'Stratios', expectedName: '☜☠☞ Vindictive' },
        { name: 'Victor Rizzo', corp: 'AP.MC', text: 'Victor Rizzo [ AP.MC ] Capsule - Victor Rizzo', charId: 95727715, typeId: 670, expectedType: 'Capsule', expectedName: 'Capsule - Victor Rizzo' },
        { name: 'Yukiko Yuuki', corp: 'AP.MC', text: 'Yukiko Yuuki [ AP.MC ] Porpoise', charId: 2123007707, typeId: 42244, expectedType: 'Porpoise', expectedName: 'Porpoise' }
      ];

      const rows = pilotsData.map(p => ({
        tagName: 'DIV',
        className: 'pilot-row',
        textContent: p.text,
        querySelectorAll(q) {
          if (q === 'img') {
            return [
              { tagName: 'IMG', getAttribute: (a) => a === 'src' ? `https://images.evetech.net/characters/${p.charId}/portrait` : (a === 'alt' ? p.name : null) },
              { tagName: 'IMG', getAttribute: (a) => a === 'src' ? `https://images.evetech.net/types/${p.typeId}/icon` : null, closest: () => null }
            ];
          }
          if (q.includes('title')) {
            return [
              { getAttribute: (a) => a === 'title' ? p.expectedName : null, closest: () => null }
            ];
          }
          return [];
        }
      }));

      const localCard = {
        tagName: 'DIV',
        className: 'panel local-panel',
        parentElement: null,
        querySelectorAll(q) {
          if (q === '*') return rows;
          return [];
        }
      };

      return [
        {
          textContent: 'Local [6]',
          parentElement: localCard
        }
      ];
    }
    return [];
  },
  querySelector() {
    return null;
  }
};

const sixResult = extractWandererPilots(sixPilotsDoc);
if (!sixResult.success || sixResult.pilots.length !== 6) {
  throw new Error(`Six pilots extraction failed: ${JSON.stringify(sixResult)}`);
}

// Verify every pilot matches expected shipType and shipName
const expectedPilots = [
  { pilot: 'Abon Riff', corp: 'AP.MC', shipType: 'Stratios', shipName: '☜☠☞ Palliser' },
  { pilot: 'Mercy Creed', corp: 'AP.MC', shipType: 'Occator', shipName: 'Occator' },
  { pilot: 'Salva Coline', corp: 'AP.MC', shipType: 'Astero', shipName: '☜☠☞ Tapir' },
  { pilot: 'Tyrom Hir', corp: 'AP.MC', shipType: 'Stratios', shipName: '☜☠☞ Vindictive' },
  { pilot: 'Victor Rizzo', corp: 'AP.MC', shipType: 'Capsule', shipName: 'Capsule - Victor Rizzo' },
  { pilot: 'Yukiko Yuuki', corp: 'AP.MC', shipType: 'Porpoise', shipName: 'Porpoise' }
];

for (let i = 0; i < expectedPilots.length; i++) {
  const exp = expectedPilots[i];
  const actual = sixResult.pilots[i];
  if (actual.pilot !== exp.pilot || actual.corp !== exp.corp || actual.shipType !== exp.shipType || actual.shipName !== exp.shipName) {
    throw new Error(`Pilot ${i} (${exp.pilot}) mismatch! Expected: ${JSON.stringify(exp)}, Got: ${JSON.stringify(actual)}`);
  }
}

console.log('✅ Local Pilots Extractor tests passed!');


