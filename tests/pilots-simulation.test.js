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

if (extracted.pilots.length !== 2) {
  throw new Error(`Expected 2 pilots, got ${extracted.pilots.length}`);
}

const p1 = extracted.pilots[0];
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
if (!p1.portraitUrl.includes('95000001')) {
  throw new Error(`Expected portraitUrl with 95000001, got "${p1.portraitUrl}"`);
}

const p2 = extracted.pilots[1];
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
if (!p2.portraitUrl.includes('95000002')) {
  throw new Error(`Expected portraitUrl with 95000002, got "${p2.portraitUrl}"`);
}

// 2. Format TSV Output
const tsv = formatPilotsData(extracted, 'tsv');
console.log('Generated Clean Pilots TSV Output:\n----------------------------------\n' + tsv);

const expectedTsv = 
`J215758 (C4)
Chrysabelle Ellecon\tAP.MC\tCapsule - Chrysa...\tCapsule\thttps://images.evetech.net/characters/95000001/portrait?size=64
Ultimate Pikie\tAP.MC\tInto the Breach\tNemesis\thttps://images.evetech.net/characters/95000002/portrait?size=64
`;

if (tsv !== expectedTsv) {
  throw new Error(`TSV output mismatch!\nExpected:\n${expectedTsv}\nGot:\n${tsv}`);
}

// 3. Format JSON Output
const json = JSON.parse(formatPilotsData(extracted, 'json'));
if (json.system !== 'J215758' || json.class !== 'C4' || json.count !== 2 || json.pilots[1].pilot !== 'Ultimate Pikie') {
  throw new Error(`JSON format invalid: ${JSON.stringify(json)}`);
}

// 4. Format Markdown Table
const md = formatPilotsData(extracted, 'markdown');
if (!md.includes('### J215758 (C4) — Local [2]') ||
    !md.includes('| Chrysabelle Ellecon | AP.MC | Capsule - Chrysa... | Capsule |') ||
    !md.includes('| Ultimate Pikie | AP.MC | Into the Breach | Nemesis |')) {
  throw new Error(`Markdown format invalid:\n${md}`);
}

console.log('✅ ALL Wanderer Local Pilots Screenshot Simulation Validations PASSED completely!');
