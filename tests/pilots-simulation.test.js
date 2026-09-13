// tests/pilots-simulation.test.js
import { extractWandererPilotsFromHtml } from '../content/pilots-extractor.js';
import { formatPilotsData } from '../lib/formatters.js';
import fs from 'fs';
import path from 'path';

console.log('--- RUNNING LIVE WANDERER LOCAL PILOTS SCREENSHOT SIMULATION TEST ---');

const htmlContent = fs.readFileSync(path.resolve('./sandbox/test-map.html'), 'utf-8');

// 1. Extract from sandbox HTML
const extracted = extractWandererPilotsFromHtml(htmlContent);

if (!extracted.success) {
  throw new Error(`Extraction failed on sandbox: ${extracted.error}`);
}

console.log(`[TEST] Extracted System: ${extracted.system} (${extracted.class}), Pilot count: ${extracted.count}`);

if (extracted.system !== 'J215758') {
  throw new Error(`Expected system J215758, got ${extracted.system}`);
}

if (extracted.class !== 'C4') {
  throw new Error(`Expected class C4, got ${extracted.class}`);
}

if (extracted.pilots.length !== 3) {
  throw new Error(`Expected 3 pilots, got ${extracted.pilots.length}`);
}

// Ensure NO structures, routes, or signatures were captured
for (const p of extracted.pilots) {
  if (/Fortizar|Raitaru|Athanor|BSG|Wormhole|Korsiki/i.test(p.pilot) ||
      /Fortizar|Raitaru|Athanor|BSG|Wormhole|Korsiki/i.test(p.shipName)) {
    throw new Error(`Extracted non-pilot row as pilot! Row: ${JSON.stringify(p)}`);
  }
}

const p1 = extracted.pilots[0];
if (p1.pilot !== 'Chrysabelle Ellecon' || p1.corp !== 'AP.MC' || p1.shipName !== 'Capsule - Chrysa...' || p1.shipType !== 'Capsule') {
  throw new Error(`Pilot 1 mismatch: ${JSON.stringify(p1)}`);
}

const p2 = extracted.pilots[1];
if (p2.pilot !== 'Shuma' || p2.corp !== 'AP.MC' || p2.shipName !== 'Never Talk To Str...' || p2.shipType !== 'Hound') {
  throw new Error(`Pilot 2 mismatch: ${JSON.stringify(p2)}`);
}

const p3 = extracted.pilots[2];
if (p3.pilot !== 'Ultimate Pikie' || p3.corp !== 'AP.MC' || p3.shipName !== 'Into the Breach' || p3.shipType !== 'Nemesis') {
  throw new Error(`Pilot 3 mismatch: ${JSON.stringify(p3)}`);
}

// 2. Format TSV Output
const tsv = formatPilotsData(extracted, 'tsv');
console.log('Generated Clean Pilots TSV Output:\n----------------------------------\n' + tsv);

const expectedTsv = 
`J215758 (C4)
https://images.evetech.net/characters/95000001/portrait?size=64\tChrysabelle Ellecon\tAP.MC\tCapsule\tCapsule - Chrysa...
https://images.evetech.net/characters/95000003/portrait?size=64\tShuma\tAP.MC\tHound\tNever Talk To Str...
https://images.evetech.net/characters/95000002/portrait?size=64\tUltimate Pikie\tAP.MC\tNemesis\tInto the Breach
`;

if (tsv !== expectedTsv) {
  throw new Error(`TSV output mismatch!\nExpected:\n${expectedTsv}\nGot:\n${tsv}`);
}

// 3. Format JSON Output
const json = JSON.parse(formatPilotsData(extracted, 'json'));
if (json.system !== 'J215758' || json.class !== 'C4' || json.count !== 3 || json.pilots[1].pilot !== 'Shuma') {
  throw new Error(`JSON format invalid: ${JSON.stringify(json)}`);
}

// 4. Format Markdown Table
const md = formatPilotsData(extracted, 'markdown');
if (!md.includes('### J215758 (C4) — Local [3]') ||
    !md.includes('| Chrysabelle Ellecon | AP.MC | Capsule | Capsule - Chrysa... |') ||
    !md.includes('| Shuma | AP.MC | Hound | Never Talk To Str... |') ||
    !md.includes('| Ultimate Pikie | AP.MC | Nemesis | Into the Breach |')) {
  throw new Error(`Markdown format invalid:\n${md}`);
}

console.log('✅ ALL Wanderer Local Pilots Screenshot Simulation Validations PASSED completely!');
