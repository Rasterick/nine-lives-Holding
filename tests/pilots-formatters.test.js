// tests/pilots-formatters.test.js
import { formatPilotsData } from '../lib/formatters.js';

const mockPilotsData = {
  system: 'J215758',
  class: 'C4',
  count: 2,
  pilots: [
    {
      pilot: 'Chrysabelle Ellecon',
      corp: 'AP.MC',
      shipName: 'Capsule - Chrysa...',
      shipType: 'Capsule',
      portraitUrl: 'https://images.evetech.net/characters/12345/portrait?size=64'
    },
    {
      pilot: 'Ultimate Pikie',
      corp: 'AP.MC',
      shipName: 'Into the Breach',
      shipType: 'Nemesis',
      portraitUrl: 'https://images.evetech.net/characters/67890/portrait?size=64'
    }
  ]
};

console.log('--- Testing formatPilotsData ---');

// 1. TSV Test (Default)
const tsv = formatPilotsData(mockPilotsData, 'tsv');
const tsvLines = tsv.trim().split('\n');

if (tsvLines[0] !== 'J215758 (C4)') {
  throw new Error(`Expected first line to be "J215758 (C4)", got "${tsvLines[0]}"`);
}
if (tsvLines[1] !== 'https://images.evetech.net/characters/12345/portrait?size=64\tChrysabelle Ellecon\tAP.MC\tCapsule - Chrysa...\tCapsule') {
  throw new Error(`Expected row 1 tab-delimited, got "${tsvLines[1]}"`);
}
if (tsvLines[2] !== 'https://images.evetech.net/characters/67890/portrait?size=64\tUltimate Pikie\tAP.MC\tInto the Breach\tNemesis') {
  throw new Error(`Expected row 2 tab-delimited, got "${tsvLines[2]}"`);
}
if (tsvLines.length !== 3) {
  throw new Error(`Expected 3 lines total (header + 2 rows), got ${tsvLines.length}`);
}

// 2. JSON Test
const jsonStr = formatPilotsData(mockPilotsData, 'json');
const parsed = JSON.parse(jsonStr);
if (parsed.system !== 'J215758' || parsed.pilots.length !== 2 || parsed.pilots[0].pilot !== 'Chrysabelle Ellecon') {
  throw new Error(`JSON output invalid: ${jsonStr}`);
}

// 3. Markdown Test
const md = formatPilotsData(mockPilotsData, 'markdown');
if (!md.includes('### J215758 (C4)') || !md.includes('| Chrysabelle Ellecon | AP.MC | Capsule - Chrysa... | Capsule |')) {
  throw new Error(`Markdown output invalid: ${md}`);
}

// 4. Empty/Edge case test
const emptyTsv = formatPilotsData(null, 'tsv');
if (emptyTsv !== '') {
  throw new Error('Expected empty string on null input');
}

console.log('✅ Pilots Formatter tests passed!');
