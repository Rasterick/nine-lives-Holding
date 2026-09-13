// tests/pilots-extractor.test.js
import { extractWandererPilots, extractWandererPilotsFromHtml } from '../content/pilots-extractor.js';

console.log('--- Testing extractWandererPilots & extractWandererPilotsFromHtml ---');

// Mock HTML matching Wanderer DOM with Signatures panel & Local panel
const mockHtml = `
<!DOCTYPE html>
<html>
<head><title>Wanderer - C4 J215758</title></head>
<body>
  <div class="panel signatures-panel">
    <div class="header">
      <span>[6]</span>
      <span>Signatures in</span>
      <span class="badge">C4</span>
      <span>J215758</span>
    </div>
  </div>

  <div class="panel local-panel">
    <div class="panel-header">
      <span class="title">Local [2]</span>
    </div>
    <div class="panel-body">
      <div class="pilot-row">
        <div class="pilot-portrait">
          <img src="https://images.evetech.net/characters/12345/portrait?size=64" alt="Chrysabelle Ellecon" />
        </div>
        <div class="pilot-info">
          <div class="pilot-name">Chrysabelle Ellecon [AP.MC]</div>
          <div class="pilot-ship">
            <span class="ship-name">Capsule - Chrysa...</span>
            <img class="ship-icon" src="/icons/capsule.png" title="Capsule" alt="Capsule" />
          </div>
        </div>
      </div>

      <div class="pilot-row">
        <div class="pilot-portrait">
          <img src="https://images.evetech.net/characters/67890/portrait?size=64" alt="Ultimate Pikie" />
        </div>
        <div class="pilot-info">
          <div class="pilot-name">Ultimate Pikie [AP.MC]</div>
          <div class="pilot-ship">
            <span class="ship-name">Into the Breach</span>
            <img class="ship-icon" src="/icons/nemesis.png" title="Nemesis" alt="Nemesis" />
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

// 1. Test HTML extraction
const result = extractWandererPilotsFromHtml(mockHtml);

if (!result.success) {
  throw new Error(`Extraction failed: ${result.error || result.message}`);
}

if (result.system !== 'J215758') {
  throw new Error(`Expected system "J215758", got "${result.system}"`);
}
if (result.class !== 'C4') {
  throw new Error(`Expected class "C4", got "${result.class}"`);
}
if (result.count !== 2 || result.pilots.length !== 2) {
  throw new Error(`Expected 2 pilots, got ${result.pilots.length}`);
}

const p1 = result.pilots[0];
if (p1.pilot !== 'Chrysabelle Ellecon') {
  throw new Error(`Expected pilot "Chrysabelle Ellecon", got "${p1.pilot}"`);
}
if (p1.corp !== 'AP.MC') {
  throw new Error(`Expected corp "AP.MC", got "${p1.corp}"`);
}
if (p1.shipName !== 'Capsule - Chrysa...') {
  throw new Error(`Expected shipName "Capsule - Chrysa...", got "${p1.shipName}"`);
}
if (p1.shipType !== 'Capsule') {
  throw new Error(`Expected shipType "Capsule", got "${p1.shipType}"`);
}
if (!p1.portraitUrl.includes('12345')) {
  throw new Error(`Expected portraitUrl containing "12345", got "${p1.portraitUrl}"`);
}

const p2 = result.pilots[1];
if (p2.pilot !== 'Ultimate Pikie') {
  throw new Error(`Expected pilot "Ultimate Pikie", got "${p2.pilot}"`);
}
if (p2.corp !== 'AP.MC') {
  throw new Error(`Expected corp "AP.MC", got "${p2.corp}"`);
}
if (p2.shipName !== 'Into the Breach') {
  throw new Error(`Expected shipName "Into the Breach", got "${p2.shipName}"`);
}
if (p2.shipType !== 'Nemesis') {
  throw new Error(`Expected shipType "Nemesis", got "${p2.shipType}"`);
}

// 2. Test Edge case: No Local panel in HTML
const emptyResult = extractWandererPilotsFromHtml('<div>Empty Page</div>');
if (emptyResult.success) {
  throw new Error('Expected failure on page without Local panel');
}

// 3. Test null doc handling in extractWandererPilots
const nullDocResult = extractWandererPilots(null);
if (nullDocResult.success || nullDocResult.error !== 'NO_DOCUMENT_AVAILABLE') {
  throw new Error('Expected NO_DOCUMENT_AVAILABLE on null doc');
}

// 4. Test Mock Document handling in extractWandererPilots
const mockDoc = {
  title: 'Wanderer - C4 J215758',
  querySelectorAll(sel) {
    if (sel === 'iframe') return [];
    if (sel === '*') {
      return [
        {
          textContent: 'Signatures in C4 J215758',
          childNodes: [{ nodeType: 3, nodeValue: 'Signatures in C4 J215758' }]
        },
        {
          textContent: 'Local [2]',
          childNodes: [{ nodeType: 3, nodeValue: 'Local [2]' }],
          parentElement: {
            classList: { contains: (c) => c === 'panel' },
            querySelectorAll(sub) {
              if (sub === 'img') return [
                { getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/12345/portrait?size=64' : null, classList: { contains: () => false } },
                { getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/67890/portrait?size=64' : null, classList: { contains: () => false } }
              ];
              if (sub.includes('pilot-row')) {
                return [
                  {
                    querySelectorAll(imgSel) {
                      if (imgSel === 'img') return [
                        { getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/12345/portrait?size=64' : null, classList: { contains: () => true } },
                        { getAttribute: (a) => a === 'title' ? 'Capsule' : null, classList: { contains: () => false } }
                      ];
                      return [];
                    },
                    querySelector(q) {
                      if (q.includes('pilot-name')) return { childNodes: [{ nodeType: 3, nodeValue: 'Chrysabelle Ellecon [AP.MC]' }] };
                      if (q.includes('ship-name')) return { childNodes: [{ nodeType: 3, nodeValue: 'Capsule - Chrysa...' }] };
                      if (q.includes('ship-icon')) return { getAttribute: (a) => a === 'title' ? 'Capsule' : null };
                      return null;
                    },
                    textContent: 'Chrysabelle Ellecon [AP.MC] Capsule - Chrysa...'
                  },
                  {
                    querySelectorAll(imgSel) {
                      if (imgSel === 'img') return [
                        { getAttribute: (a) => a === 'src' ? 'https://images.evetech.net/characters/67890/portrait?size=64' : null, classList: { contains: () => true } },
                        { getAttribute: (a) => a === 'title' ? 'Nemesis' : null, classList: { contains: () => false } }
                      ];
                      return [];
                    },
                    querySelector(q) {
                      if (q.includes('pilot-name')) return { childNodes: [{ nodeType: 3, nodeValue: 'Ultimate Pikie [AP.MC]' }] };
                      if (q.includes('ship-name')) return { childNodes: [{ nodeType: 3, nodeValue: 'Into the Breach' }] };
                      if (q.includes('ship-icon')) return { getAttribute: (a) => a === 'title' ? 'Nemesis' : null };
                      return null;
                    },
                    textContent: 'Ultimate Pikie [AP.MC] Into the Breach'
                  }
                ];
              }
              return [];
            }
          }
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
if (!domResult.success || domResult.pilots.length !== 2) {
  throw new Error(`DOM Walker Extraction failed: ${JSON.stringify(domResult)}`);
}
if (domResult.system !== 'J215758' || domResult.class !== 'C4') {
  throw new Error(`DOM Walker System mismatch: ${domResult.system} (${domResult.class})`);
}
if (domResult.pilots[0].pilot !== 'Chrysabelle Ellecon' || domResult.pilots[1].shipType !== 'Nemesis') {
  throw new Error(`DOM Walker Pilot parsing mismatch: ${JSON.stringify(domResult.pilots)}`);
}

console.log('✅ Local Pilots Extractor tests passed!');
